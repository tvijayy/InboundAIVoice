"""
ultravox_client.py — Thin wrapper around the Ultravox REST API.

Docs: https://docs.ultravox.ai/api-reference/
"""

import os
import logging
import httpx
from typing import Any

logger = logging.getLogger("ultravox-client")

ULTRAVOX_BASE = "https://api.ultravox.ai/api"


def _get_headers() -> dict:
    api_key = os.environ.get("ULTRAVOX_API_KEY", "")
    if not api_key:
        raise ValueError("ULTRAVOX_API_KEY is not set")
    return {
        "X-API-Key": api_key,
        "Content-Type": "application/json",
    }


# ── Create a call ─────────────────────────────────────────────────────────────

async def create_call(
    system_prompt: str,
    tools: list[dict] | None = None,
    voice: str | None = None,
    language_hint: str | None = None,
    first_speaker: str = "FIRST_SPEAKER_USER",
    max_duration: str = "600s",
    temperature: float = 0.4,
    metadata: dict | None = None,
) -> dict:
    """
    Create an Ultravox call.

    Returns the full call object including `joinUrl` (WebSocket URL for audio)
    and `callId`.

    Args:
        system_prompt: The agent's system prompt.
        tools: List of Ultravox tool definitions (server tools).
        voice: Ultravox voice name (e.g. "Mark", "Emily").
        language_hint: BCP-47 language code hint (e.g. "en-IN", "hi-IN").
        first_speaker: "FIRST_SPEAKER_USER" or "FIRST_SPEAKER_AGENT".
        max_duration: Max call duration (e.g., "600s" = 10 minutes).
        temperature: LLM temperature (0.0–1.0).
        metadata: Arbitrary metadata dict attached to the call.

    Returns:
        dict with keys: callId, joinUrl, status, created, etc.
    """
    payload: dict[str, Any] = {
        "systemPrompt": system_prompt,
        "firstSpeaker": first_speaker,
        "maxDuration": max_duration,
        "temperature": temperature,
    }

    if voice:
        payload["voice"] = voice
    if language_hint:
        payload["languageHint"] = language_hint
    if tools:
        payload["selectedTools"] = tools
    if metadata:
        payload["metadata"] = metadata

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{ULTRAVOX_BASE}/calls",
            headers=_get_headers(),
            json=payload,
        )
        if resp.status_code not in (200, 201):
            logger.error(f"[ULTRAVOX] create_call failed {resp.status_code}: {resp.text}")
            resp.raise_for_status()
        data = resp.json()
        logger.info(f"[ULTRAVOX] Call created: callId={data.get('callId')} joinUrl={data.get('joinUrl','')[:60]}...")
        return data


# ── Get a call ────────────────────────────────────────────────────────────────

async def get_call(call_id: str) -> dict:
    """Fetch a call object by ID."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{ULTRAVOX_BASE}/calls/{call_id}",
            headers=_get_headers(),
        )
        resp.raise_for_status()
        return resp.json()


# ── List call messages (transcript) ──────────────────────────────────────────

async def list_messages(call_id: str) -> list[dict]:
    """
    Fetch all messages for a call (the full transcript).
    Returns list of {role, text, medium, callStageMessageIndex, ...}
    """
    messages = []
    cursor = None
    async with httpx.AsyncClient(timeout=10.0) as client:
        while True:
            params: dict = {"callId": call_id, "pageSize": 100}
            if cursor:
                params["cursor"] = cursor
            resp = await client.get(
                f"{ULTRAVOX_BASE}/calls/{call_id}/messages",
                headers=_get_headers(),
                params=params,
            )
            resp.raise_for_status()
            body = resp.json()
            results = body.get("results", [])
            messages.extend(results)
            cursor = body.get("next")
            if not cursor:
                break
    return messages


# ── End a call ────────────────────────────────────────────────────────────────

async def end_call(call_id: str) -> bool:
    """Hang up a call by deleting it (Ultravox terminates on DELETE)."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.delete(
                f"{ULTRAVOX_BASE}/calls/{call_id}",
                headers=_get_headers(),
            )
            logger.info(f"[ULTRAVOX] end_call: {call_id} → {resp.status_code}")
            return resp.status_code in (200, 204)
    except Exception as e:
        logger.error(f"[ULTRAVOX] end_call failed: {e}")
        return False


# ── Build tool definitions ────────────────────────────────────────────────────

def build_server_tools(base_url: str) -> list[dict]:
    """
    Build the Ultravox selectedTools list, using our FastAPI server as the
    HTTP tool backend.

    base_url: The public base URL of this server (e.g. https://yourserver.com)
    """
    base_url = base_url.rstrip("/")
    return [
        {
            "temporaryTool": {
                "modelToolName": "check_availability",
                "description": "Check available appointment slots for a given date. Call this when user asks about availability.",
                "dynamicParameters": [
                    {
                        "name": "date",
                        "location": "PARAMETER_LOCATION_BODY",
                        "schema": {
                            "type": "string",
                            "description": "Date to check in YYYY-MM-DD format e.g. '2026-03-01'",
                        },
                        "required": True,
                    }
                ],
                "http": {
                    "baseUrlPattern": f"{base_url}/tools/check_availability",
                    "httpMethod": "POST",
                },
            }
        },
        {
            "temporaryTool": {
                "modelToolName": "save_booking_intent",
                "description": "Save booking intent after caller confirms appointment. Call ONCE after you have name, phone, date, time.",
                "dynamicParameters": [
                    {
                        "name": "start_time",
                        "location": "PARAMETER_LOCATION_BODY",
                        "schema": {
                            "type": "string",
                            "description": "ISO 8601 datetime e.g. '2026-03-01T10:00:00+05:30'",
                        },
                        "required": True,
                    },
                    {
                        "name": "caller_name",
                        "location": "PARAMETER_LOCATION_BODY",
                        "schema": {"type": "string", "description": "Full name of the caller"},
                        "required": True,
                    },
                    {
                        "name": "caller_phone",
                        "location": "PARAMETER_LOCATION_BODY",
                        "schema": {"type": "string", "description": "Phone number of the caller"},
                        "required": True,
                    },
                    {
                        "name": "notes",
                        "location": "PARAMETER_LOCATION_BODY",
                        "schema": {"type": "string", "description": "Any notes, email, or special requests"},
                        "required": False,
                    },
                ],
                "http": {
                    "baseUrlPattern": f"{base_url}/tools/save_booking_intent",
                    "httpMethod": "POST",
                },
            }
        },
        {
            "temporaryTool": {
                "modelToolName": "get_business_hours",
                "description": "Check if the business is currently open and what the operating hours are.",
                "dynamicParameters": [],
                "http": {
                    "baseUrlPattern": f"{base_url}/tools/get_business_hours",
                    "httpMethod": "POST",
                },
            }
        },
        {
            "temporaryTool": {
                "modelToolName": "transfer_call",
                "description": "Transfer this call to a human agent. Use if: caller asks for human, is angry, or query is outside scope.",
                "dynamicParameters": [],
                "http": {
                    "baseUrlPattern": f"{base_url}/tools/transfer_call",
                    "httpMethod": "POST",
                },
            }
        },
        {
            "temporaryTool": {
                "modelToolName": "end_call",
                "description": "End the call. Use ONLY when caller says bye/goodbye or after booking is fully confirmed.",
                "dynamicParameters": [],
                "http": {
                    "baseUrlPattern": f"{base_url}/tools/end_call",
                    "httpMethod": "POST",
                },
            }
        },
    ]
