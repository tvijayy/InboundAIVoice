import os
import json
import logging
from fastapi import FastAPI, Request, HTTPException
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv(".env.local")
load_dotenv(".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ultravox-saas")

app = FastAPI(title="VoiceSaaS Webhook Server")

ULTRAVOX_API_URL = "https://api.ultravox.ai/api/calls"
ULTRAVOX_API_KEY = os.getenv("ULTRAVOX_API_KEY", "")

@app.get("/health")
async def health_check():
    """Simple health check for your SaaS."""
    return {"status": "ok", "message": "VoiceSaaS Backend is running."}

@app.post("/incoming-call")
async def handle_incoming_call(request: Request):
    """
    This is the webhook endpoint that Vobiz or Twilio will hit when a customer
    dials one of your client's phone numbers.
    """
    # 1. Parse the incoming request from the telephony provider
    payload = await request.json()
    
    # Normally, you would extract the 'To' number here, e.g. +1234567890
    client_phone_number = payload.get("To", "unknown")
    caller_phone_number = payload.get("From", "unknown")
    
    logger.info(f"Incoming call to {client_phone_number} from {caller_phone_number}")

    # 2. SAAS LOGIC: Look up the client's settings in Supabase
    # For now, we are mocking the database lookup. 
    # In production: fetch from Supabase based on `client_phone_number`.
    client_system_prompt = (
        "You are a helpful AI assistant for a dental clinic. "
        "Your job is to answer questions and book appointments."
    )
    client_voice = "Mark" # Using an Ultravox voice

    if not ULTRAVOX_API_KEY:
        logger.error("ULTRAVOX_API_KEY is missing from .env!")
        raise HTTPException(status_code=500, detail="Server configuration error")

    # 3. Create the Ultravox Call
    # We ask Ultravox to prepare an AI agent with the client's custom prompt
    headers = {
        "X-API-Key": ULTRAVOX_API_KEY,
        "Content-Type": "application/json"
    }
    
    ultravox_payload = {
        "systemPrompt": client_system_prompt,
        "model": "fixie-ai/ultravox",
        "voice": client_voice,
        "temperature": 0.4,
        # We can attach the client's tools here later! (e.g., check_calendar)
        "selectedTools": []
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                ULTRAVOX_API_URL, 
                headers=headers, 
                json=ultravox_payload,
                timeout=10.0
            )
            resp.raise_for_status()
            ultravox_data = resp.json()
            
            join_url = ultravox_data.get("joinUrl")
            call_id = ultravox_data.get("callId")
            
            logger.info(f"Ultravox call created! Call ID: {call_id}")
            
            # 4. Return the Join URL to the Telephony Provider
            # The provider (Twilio/Vobiz) will use this WebRTC/WebSocket URL 
            # to stream the phone audio directly to Ultravox.
            return {
                "success": True,
                "ultravox_join_url": join_url,
                "message": "Connect your audio stream to the join_url"
            }
            
    except Exception as e:
        logger.error(f"Failed to create Ultravox call: {e}")
        raise HTTPException(status_code=500, detail="Failed to initialize AI")

if __name__ == "__main__":
    import uvicorn
    # Start the local development server on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
