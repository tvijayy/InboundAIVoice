"""
webhook_server.py — FastAPI server that bridges VoBiz inbound calls → Ultravox.

Endpoints:
  POST /vobiz/inbound      — VoBiz calls this when a call arrives
  POST /tools/*            — Ultravox calls these when the AI uses a tool
  POST /ultravox/events    — Ultravox posts call lifecycle events here
  GET  /health             — Health check
"""

import os
import json
import logging
import asyncio
import time
import re
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

import httpx
import pytz
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse, PlainTextResponse

load_dotenv()

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("webhook-server")

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Azlon AI Voice — Ultravox + VoBiz Bridge", version="2.0.0")

# ── In-memory call state store ────────────────────────────────────────────────
# Maps call_id → { caller_phone, caller_name, booking_intent, start_time, ... }
_call_state: dict[str, dict] = {}

# ── Rate limiting ─────────────────────────────────────────────────────────────
_call_timestamps: dict = defaultdict(list)
RATE_LIMIT_CALLS  = 5
RATE_LIMIT_WINDOW = 3600  # 1 hour

def is_rate_limited(phone: str) -> bool:
    if phone in ("unknown", "demo", ""):
        return False
    now = time.time()
    _call_timestamps[phone] = [t for t in _call_timestamps[phone] if now - t < RATE_LIMIT_WINDOW]
    if len(_call_timestamps[phone]) >= RATE_LIMIT_CALLS:
        return True
    _call_timestamps[phone].append(now)
    return False


# ══════════════════════════════════════════════════════════════════════════════
# CONFIG
# ══════════════════════════════════════════════════════════════════════════════

CONFIG_FILE = "config.json"

def get_live_config(phone_number: str | None = None) -> dict:
    """Load config — tries per-client file first, then default config.json."""
    config = {}
    paths = []
    if phone_number and phone_number not in ("unknown", ""):
        clean = phone_number.replace("+", "").replace(" ", "")
        paths.append(f"configs/{clean}.json")
    paths += ["configs/default.json", CONFIG_FILE]

    for path in paths:
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    config = json.load(f)
                    logger.info(f"[CONFIG] Loaded: {path}")
                    break
            except Exception as e:
                logger.error(f"[CONFIG] Failed to read {path}: {e}")

    return {
        "agent_instructions": config.get("agent_instructions", ""),
        "llm_model":          config.get("llm_model", ""),
        "tts_voice":          config.get("tts_voice", ""),
        "lang_preset":        config.get("lang_preset", "multilingual"),
        "max_turns":          config.get("max_turns", 25),
        "first_line":         config.get("first_line", ""),
        "ultravox_voice":     config.get("ultravox_voice", os.getenv("ULTRAVOX_VOICE", "Mark")),
        "ultravox_language_hint": config.get("ultravox_language_hint", os.getenv("ULTRAVOX_LANGUAGE_HINT", "en-IN")),
        **config,
    }


# ── IST time context ──────────────────────────────────────────────────────────

def get_ist_time_context() -> str:
    ist = pytz.timezone("Asia/Kolkata")
    now = datetime.now(ist)
    today_str = now.strftime("%A, %B %d, %Y")
    time_str  = now.strftime("%I:%M %p")
    days_lines = []
    for i in range(7):
        day   = now + timedelta(days=i)
        label = "Today" if i == 0 else ("Tomorrow" if i == 1 else day.strftime("%A"))
        days_lines.append(f"  {label}: {day.strftime('%A %d %B %Y')} → ISO {day.strftime('%Y-%m-%d')}")
    days_block = "\n".join(days_lines)
    return (
        f"\n\n[SYSTEM CONTEXT]\n"
        f"Current date & time: {today_str} at {time_str} IST\n"
        f"Resolve ALL relative day references using this table:\n{days_block}\n"
        f"Always use ISO dates when calling save_booking_intent. Appointments in IST (+05:30).]"
    )


# ── Language presets ──────────────────────────────────────────────────────────

LANGUAGE_PRESETS = {
    "hinglish":    "Speak in natural Hinglish — mix Hindi and English like educated Indians do.",
    "hindi":       "Speak only in pure Hindi. Avoid English words wherever a Hindi equivalent exists.",
    "english":     "Speak only in Indian English with a warm, professional tone.",
    "tamil":       "Speak only in Tamil. Use standard spoken Tamil for a professional context.",
    "telugu":      "Speak only in Telugu. Use clear, polite spoken Telugu.",
    "gujarati":    "Speak only in Gujarati. Use polite, professional Gujarati.",
    "bengali":     "Speak only in Bengali (Bangla). Use standard, polite spoken Bengali.",
    "marathi":     "Speak only in Marathi. Use polite, standard spoken Marathi.",
    "kannada":     "Speak only in Kannada. Use clear, professional spoken Kannada.",
    "malayalam":   "Speak only in Malayalam. Use polite, professional spoken Malayalam.",
    "multilingual":"Detect the caller's language from their first message and reply in that SAME language. Supported: Hindi, Hinglish, English, Tamil, Telugu, Gujarati, Bengali, Marathi, Kannada, Malayalam.",
}

def get_language_instruction(lang_preset: str) -> str:
    instr = LANGUAGE_PRESETS.get(lang_preset, LANGUAGE_PRESETS["multilingual"])
    return f"\n\n[LANGUAGE DIRECTIVE]\n{instr}"


# ── Build system prompt ───────────────────────────────────────────────────────

def build_system_prompt(live_config: dict, caller_history: str = "") -> str:
    base = live_config.get("agent_instructions", "")
    ist_ctx = get_ist_time_context()
    lang_instr = get_language_instruction(live_config.get("lang_preset", "multilingual"))
    prompt = base + ist_ctx + lang_instr
    if caller_history:
        prompt += f"\n\n{caller_history}"
    return prompt


# ── Caller memory from Supabase ───────────────────────────────────────────────

async def get_caller_history(phone: str) -> str:
    if not phone or phone == "unknown":
        return ""
    try:
        import db
        sb = db.get_supabase()
        if not sb:
            return ""
        result = (sb.table("call_logs")
                    .select("summary, created_at")
                    .eq("phone_number", phone)
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute())
        if result.data:
            last = result.data[0]
            return f"[CALLER HISTORY: Last call {last['created_at'][:10]}. Summary: {last['summary']}]"
    except Exception as e:
        logger.warning(f"[MEMORY] Could not load history: {e}")
    return ""


# ══════════════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {"status": "ok", "service": "azlon-ultravox-bridge", "version": "2.0.0"}


# ══════════════════════════════════════════════════════════════════════════════
# VOBIZ INBOUND WEBHOOK
# POST /vobiz/inbound
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/vobiz/inbound")
async def vobiz_inbound(request: Request):
    """
    Called by VoBiz when an inbound SIP call arrives.

    VoBiz sends form data or JSON with:
      - From / from_number / caller  → caller phone
      - To / to_number               → called number
      - CallSid / call_id            → unique call identifier

    We create an Ultravox call and return the joinUrl so VoBiz can bridge audio.
    """
    from ultravox_client import create_call, build_server_tools

    # ── Parse incoming payload ────────────────────────────────────────────────
    content_type = request.headers.get("content-type", "")
    try:
        if "application/json" in content_type:
            body = await request.json()
        else:
            form = await request.form()
            body = dict(form)
    except Exception:
        body = {}

    logger.info(f"[VOBIZ] Inbound webhook: {json.dumps(body, default=str)[:500]}")

    # Normalise field names (VoBiz may use different casing)
    caller_phone = (
        body.get("From") or body.get("from") or
        body.get("from_number") or body.get("caller") or "unknown"
    )
    called_number = (
        body.get("To") or body.get("to") or
        body.get("to_number") or body.get("called") or ""
    )
    vobiz_call_id = (
        body.get("CallSid") or body.get("call_id") or
        body.get("callId") or body.get("id") or "unknown"
    )
    caller_name = body.get("CallerName") or body.get("caller_name") or ""

    # Clean up phone number
    caller_phone = str(caller_phone).strip()
    if caller_phone and not caller_phone.startswith("+") and len(caller_phone) >= 10:
        caller_phone = "+" + caller_phone.lstrip("+")

    logger.info(f"[VOBIZ] Caller: {caller_phone} → {called_number} | VoBiz CallId: {vobiz_call_id}")

    # ── Rate limit ────────────────────────────────────────────────────────────
    if is_rate_limited(caller_phone):
        logger.warning(f"[RATE-LIMIT] Blocked {caller_phone}")
        return PlainTextResponse("", status_code=200)  # silently reject

    # ── Load config ───────────────────────────────────────────────────────────
    live_config = get_live_config(caller_phone)

    # ── Caller memory ─────────────────────────────────────────────────────────
    caller_history = await get_caller_history(caller_phone)

    # ── Build system prompt ───────────────────────────────────────────────────
    system_prompt = build_system_prompt(live_config, caller_history)

    # ── Build tools list ──────────────────────────────────────────────────────
    server_base_url = os.environ.get("SERVER_BASE_URL", "http://localhost:8000").rstrip("/")
    tools = build_server_tools(server_base_url)

    # ── Determine voice & language ────────────────────────────────────────────
    voice = live_config.get("ultravox_voice") or os.environ.get("ULTRAVOX_VOICE", "Mark")
    language_hint = live_config.get("ultravox_language_hint") or os.environ.get("ULTRAVOX_LANGUAGE_HINT", "en-IN")

    # First speaker: agent greets first (since AI speaks first)
    first_line = live_config.get("first_line", "")
    if first_line:
        # Inject the first line as initial agent utterance via initialOutputMedium approach
        # We add it to the system prompt as a MUST SAY instruction
        system_prompt += f"\n\n[FIRST MESSAGE - SAY EXACTLY THIS TO START]: {first_line}"

    # ── Create Ultravox call ──────────────────────────────────────────────────
    try:
        uv_call = await create_call(
            system_prompt=system_prompt,
            tools=tools,
            voice=voice,
            language_hint=language_hint,
            first_speaker="FIRST_SPEAKER_AGENT",  # AI speaks first (greets caller)
            max_duration="600s",
            temperature=0.4,
            metadata={
                "caller_phone": caller_phone,
                "caller_name":  caller_name,
                "vobiz_call_id": vobiz_call_id,
                "called_number": called_number,
            },
        )
    except Exception as e:
        logger.error(f"[ULTRAVOX] Failed to create call: {e}")
        return JSONResponse({"error": "Failed to create AI call"}, status_code=500)

    uv_call_id = uv_call.get("callId", "")
    join_url = uv_call.get("joinUrl", "")

    logger.info(f"[ULTRAVOX] Call created: callId={uv_call_id}")

    # ── Store call state ──────────────────────────────────────────────────────
    _call_state[uv_call_id] = {
        "caller_phone":  caller_phone,
        "caller_name":   caller_name,
        "vobiz_call_id": vobiz_call_id,
        "start_time":    datetime.utcnow().isoformat(),
        "booking_intent": None,
        "live_config":   live_config,
        "voice":         voice,
    }

    # ── Upsert active_calls in Supabase ──────────────────────────────────────
    try:
        import db
        sb = db.get_supabase()
        if sb:
            sb.table("active_calls").upsert({
                "room_id":     uv_call_id,
                "phone":       caller_phone,
                "caller_name": caller_name,
                "status":      "active",
                "last_updated": datetime.utcnow().isoformat(),
            }).execute()
    except Exception as e:
        logger.debug(f"[ACTIVE-CALL] {e}")

    # ── Return VoBiz-compatible response ──────────────────────────────────────
    # VoBiz expects a JSON response telling it where to connect audio.
    # The exact format depends on your VoBiz plan/version. Common formats:
    #   { "action": "connect", "url": "<websocket_url>" }
    # or a SIP redirect header.
    # Adjust the response format below to match your VoBiz documentation.
    return JSONResponse({
        "action":  "connect",
        "url":     join_url,
        "callId":  uv_call_id,
    })


# ══════════════════════════════════════════════════════════════════════════════
# ULTRAVOX TOOL ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

def _get_call_id_from_request(body: dict, request: Request) -> str:
    """Extract Ultravox callId from tool call request headers or body."""
    # Ultravox sends X-Ultravox-Call-Id header
    call_id = request.headers.get("X-Ultravox-Call-Id", "")
    if not call_id:
        call_id = body.get("callId") or body.get("call_id") or ""
    return call_id


# ── Tool: check_availability ──────────────────────────────────────────────────

@app.post("/tools/check_availability")
async def tool_check_availability(request: Request):
    body = await request.json()
    call_id = _get_call_id_from_request(body, request)
    date = body.get("date", "")

    logger.info(f"[TOOL] check_availability: callId={call_id} date={date}")

    if not date:
        return JSONResponse({"result": "Please provide a valid date in YYYY-MM-DD format."})

    try:
        from calendar_tools import get_available_slots
        slots = get_available_slots(date)
        if not slots:
            return JSONResponse({"result": f"No available slots on {date}. Would you like to check another date?"})
        slot_strs = []
        for s in slots[:6]:
            t = s.get("label") or s.get("time", "")
            if "T" in t:
                t = t.split("T")[1][:5]
            slot_strs.append(t)
        return JSONResponse({"result": f"Available slots on {date}: {', '.join(slot_strs)} IST."})
    except Exception as e:
        logger.error(f"[TOOL] check_availability error: {e}")
        return JSONResponse({"result": "I'm having trouble checking the calendar right now."})


# ── Tool: save_booking_intent ─────────────────────────────────────────────────

@app.post("/tools/save_booking_intent")
async def tool_save_booking_intent(request: Request):
    body = await request.json()
    call_id = _get_call_id_from_request(body, request)

    start_time   = body.get("start_time", "")
    caller_name  = body.get("caller_name", "")
    caller_phone = body.get("caller_phone", "")
    notes        = body.get("notes", "")

    logger.info(f"[TOOL] save_booking_intent: callId={call_id} name={caller_name} time={start_time}")

    if call_id and call_id in _call_state:
        _call_state[call_id]["booking_intent"] = {
            "start_time":   start_time,
            "caller_name":  caller_name,
            "caller_phone": caller_phone or _call_state[call_id].get("caller_phone", ""),
            "notes":        notes,
        }
        if caller_name:
            _call_state[call_id]["caller_name"] = caller_name

    return JSONResponse({"result": f"Booking intent saved for {caller_name} at {start_time}. I'll confirm after the call."})


# ── Tool: get_business_hours ──────────────────────────────────────────────────

@app.post("/tools/get_business_hours")
async def tool_get_business_hours(request: Request):
    ist = pytz.timezone("Asia/Kolkata")
    now = datetime.now(ist)
    hours = {
        0: ("Monday",    "10:00", "19:00"),
        1: ("Tuesday",   "10:00", "19:00"),
        2: ("Wednesday", "10:00", "19:00"),
        3: ("Thursday",  "10:00", "19:00"),
        4: ("Friday",    "10:00", "19:00"),
        5: ("Saturday",  "10:00", "17:00"),
        6: ("Sunday",    None,    None),
    }
    day_name, open_t, close_t = hours[now.weekday()]
    current_time = now.strftime("%H:%M")

    if open_t is None:
        result = "We are closed on Sundays. Next opening: Monday 10:00 AM IST."
    elif open_t <= current_time <= close_t:
        result = f"We are OPEN. Today ({day_name}): {open_t}–{close_t} IST."
    else:
        result = f"We are CLOSED. Today ({day_name}): {open_t}–{close_t} IST."

    return JSONResponse({"result": result})


# ── Tool: transfer_call ───────────────────────────────────────────────────────

@app.post("/tools/transfer_call")
async def tool_transfer_call(request: Request):
    body = await request.json()
    call_id = _get_call_id_from_request(body, request)
    logger.info(f"[TOOL] transfer_call: callId={call_id}")

    transfer_number = os.environ.get("DEFAULT_TRANSFER_NUMBER", "")
    if not transfer_number:
        return JSONResponse({"result": "No transfer number configured. I cannot transfer right now."})

    # For VoBiz, transfer is handled via the VoBiz API or SIP REFER.
    # Here we log it and tell the AI — actual SIP transfer happens at the telephony layer.
    # TODO: trigger VoBiz transfer API if available.
    state = _call_state.get(call_id, {})
    vobiz_call_id = state.get("vobiz_call_id", "")
    logger.info(f"[TRANSFER] VoBiz call {vobiz_call_id} → {transfer_number}")
    return JSONResponse({"result": f"Transferring you to a human agent now. Please hold."})


# ── Tool: end_call ────────────────────────────────────────────────────────────

@app.post("/tools/end_call")
async def tool_end_call(request: Request, background_tasks: BackgroundTasks):
    body = await request.json()
    call_id = _get_call_id_from_request(body, request)
    logger.info(f"[TOOL] end_call: callId={call_id}")

    if call_id:
        from ultravox_client import end_call as uv_end_call
        background_tasks.add_task(uv_end_call, call_id)

    return JSONResponse({"result": "Call ended. Goodbye!"})


# ══════════════════════════════════════════════════════════════════════════════
# ULTRAVOX EVENT WEBHOOK
# POST /ultravox/events
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/ultravox/events")
async def ultravox_events(request: Request, background_tasks: BackgroundTasks):
    """
    Ultravox posts lifecycle events here.
    We handle `call.ended` to trigger post-call processing.
    """
    try:
        event = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type = event.get("event") or event.get("type") or ""
    call_id = event.get("callId") or event.get("call_id") or ""

    logger.info(f"[ULTRAVOX-EVENT] type={event_type} callId={call_id}")

    if event_type in ("call.ended", "call_ended", "callEnded"):
        background_tasks.add_task(handle_call_ended, call_id, event)

    return JSONResponse({"received": True})


# ── Post-call processing ──────────────────────────────────────────────────────

async def handle_call_ended(call_id: str, event: dict):
    """Run after a call ends: build transcript, save to Supabase, notify Telegram, create booking."""
    logger.info(f"[SHUTDOWN] Post-call processing for callId={call_id}")

    state = _call_state.pop(call_id, {})
    caller_phone  = state.get("caller_phone", "unknown")
    caller_name   = state.get("caller_name", "")
    booking_intent = state.get("booking_intent")
    live_config   = state.get("live_config", {})
    voice         = state.get("voice", "")
    start_iso     = state.get("start_time")

    # Duration
    duration = 0
    if start_iso:
        try:
            start_dt = datetime.fromisoformat(start_iso)
            duration = int((datetime.utcnow() - start_dt).total_seconds())
        except Exception:
            pass

    # ── Fetch transcript from Ultravox ────────────────────────────────────────
    transcript_text = ""
    try:
        from ultravox_client import list_messages
        messages = await list_messages(call_id)
        lines = []
        for msg in messages:
            role = msg.get("role", "")
            text = msg.get("text", "")
            if role in ("agent", "user") and text:
                label = "AGENT" if role == "agent" else "USER"
                lines.append(f"[{label}] {text}")
        transcript_text = "\n".join(lines)
        logger.info(f"[TRANSCRIPT] {len(lines)} messages fetched for {call_id}")
    except Exception as e:
        logger.error(f"[TRANSCRIPT] Failed to fetch: {e}")
        transcript_text = event.get("transcript", "") or "unavailable"

    # ── Sentiment analysis ────────────────────────────────────────────────────
    sentiment = "unknown"
    if transcript_text and transcript_text != "unavailable":
        try:
            import openai as _oai
            _client = _oai.AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
            resp = await _client.chat.completions.create(
                model="gpt-4o-mini", max_tokens=5,
                messages=[{"role": "user", "content":
                    f"Classify this call as one word: positive, neutral, negative, or frustrated.\n\n{transcript_text[:800]}"}]
            )
            sentiment = resp.choices[0].message.content.strip().lower()
            logger.info(f"[SENTIMENT] {sentiment}")
        except Exception as e:
            logger.warning(f"[SENTIMENT] Failed: {e}")

    # ── Cost estimation ───────────────────────────────────────────────────────
    def estimate_cost(dur: int, chars: int) -> float:
        return round(
            (dur / 60) * 0.002 +
            (dur / 60) * 0.006 +
            (chars / 1000) * 0.003 +
            (chars / 4000) * 0.0001,
            5
        )
    estimated_cost = estimate_cost(duration, len(transcript_text))

    # ── IST timestamps ────────────────────────────────────────────────────────
    ist = pytz.timezone("Asia/Kolkata")
    call_dt = datetime.utcnow().astimezone(ist)

    # ── Booking ───────────────────────────────────────────────────────────────
    booking_status_msg = "No booking"
    if booking_intent:
        try:
            from calendar_tools import async_create_booking
            result = await async_create_booking(
                start_time=booking_intent["start_time"],
                caller_name=booking_intent["caller_name"] or "Unknown Caller",
                caller_phone=booking_intent["caller_phone"],
                notes=booking_intent.get("notes", ""),
            )
            if result.get("success"):
                booking_status_msg = f"Booking Confirmed: {result.get('booking_id')}"
                logger.info(f"[BOOKING] Confirmed: {result.get('booking_id')}")
                from notify import notify_booking_confirmed
                notify_booking_confirmed(
                    caller_name=booking_intent["caller_name"],
                    caller_phone=booking_intent["caller_phone"],
                    booking_time_iso=booking_intent["start_time"],
                    booking_id=result.get("booking_id"),
                    notes=booking_intent.get("notes", ""),
                    tts_voice=voice,
                    ai_summary="",
                )
            else:
                booking_status_msg = f"Booking Failed: {result.get('message')}"
                logger.warning(f"[BOOKING] Failed: {result.get('message')}")
        except Exception as e:
            logger.error(f"[BOOKING] Exception: {e}")
            booking_status_msg = f"Booking Error: {e}"
    else:
        try:
            from notify import notify_call_no_booking
            notify_call_no_booking(
                caller_name=caller_name,
                caller_phone=caller_phone,
                call_summary="Caller did not schedule during this call.",
                tts_voice=voice,
                duration_seconds=duration,
            )
        except Exception as e:
            logger.debug(f"[NOTIFY] No-booking notification failed: {e}")

    # ── Update active_calls → completed ──────────────────────────────────────
    try:
        import db
        sb = db.get_supabase()
        if sb:
            sb.table("active_calls").upsert({
                "room_id":     call_id,
                "phone":       caller_phone,
                "caller_name": caller_name,
                "status":      "completed",
                "last_updated": datetime.utcnow().isoformat(),
            }).execute()
    except Exception as e:
        logger.debug(f"[ACTIVE-CALL] update error: {e}")

    # ── Save call log to Supabase ─────────────────────────────────────────────
    try:
        import db
        db.save_call_log(
            phone=caller_phone,
            duration=duration,
            transcript=transcript_text,
            summary=booking_status_msg,
            recording_url="",
            caller_name=caller_name,
            sentiment=sentiment,
            estimated_cost_usd=estimated_cost,
            call_date=call_dt.date().isoformat(),
            call_hour=call_dt.hour,
            call_day_of_week=call_dt.strftime("%A"),
            was_booked=bool(booking_intent),
            interrupt_count=0,
        )
        logger.info(f"[DB] Call log saved for {caller_phone}")
    except Exception as e:
        logger.error(f"[DB] save_call_log failed: {e}")

    # ── n8n webhook (optional) ────────────────────────────────────────────────
    _n8n_url = os.getenv("N8N_WEBHOOK_URL")
    if _n8n_url:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(_n8n_url, json={
                    "event":        "call_completed",
                    "phone":        caller_phone,
                    "caller_name":  caller_name,
                    "duration":     duration,
                    "booked":       bool(booking_intent),
                    "sentiment":    sentiment,
                    "summary":      booking_status_msg,
                    "recording_url": "",
                    "interrupt_count": 0,
                })
            logger.info("[N8N] Webhook triggered")
        except Exception as e:
            logger.warning(f"[N8N] Webhook failed: {e}")

    logger.info(f"[SHUTDOWN] Post-call complete for {caller_phone} | {booking_status_msg}")


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("webhook_server:app", host="0.0.0.0", port=port, reload=False)
