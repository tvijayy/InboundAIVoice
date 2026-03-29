const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
// Twilio sends urlencoded requests for inbound webhooks
app.use(express.urlencoded({ extended: true }));

// Environmental Variables checking
const PORT = process.env.PORT || 8000;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const ULTRAVOX_API_KEY = process.env.ULTRAVOX_API_KEY;

let twilioClient;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

/**
 * Helper to create an active Ultravox Voice session.
 * Used identically for both Inbound and Outbound calling.
 */
async function createUltravoxCall(systemPrompt) {
    const response = await fetch('https://api.ultravox.ai/api/calls', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': ULTRAVOX_API_KEY
        },
        body: JSON.stringify({
            systemPrompt: systemPrompt || "You are a helpful SaaS agent.",
            model: "fixie-ai/ultravox", // Best standard default
            medium: { twilio: {} }     // Inform Ultravox this stream uses Twilio
        })
    });

    if (!response.ok) {
        throw new Error(`Ultravox API Error: ${await response.text()}`);
    }
    
    return await response.json(); // Returns { joinUrl, callId }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. INBOUND CALLING (Twilio Webhook)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/twilio/inbound', async (req, res) => {
    try {
        const callerPhone = req.body.From;
        console.log(`[INBOUND] Received call from: ${callerPhone}`);

        // 1. You would query your Supabase DB here for the custom Prompt using callerPhone
        const prompt = "You are a highly professional inbound answering service.";

        // 2. Generate a secure streaming URL from Ultravox
        const uvCall = await createUltravoxCall(prompt);
        console.log(`[INBOUND] Ultravox Call Created: ${uvCall.callId}`);

        // 3. Return XML (TwiML) to Twilio to instantly bridge the audio
        const twiml = `
        <Response>
            <Connect>
                <Stream url="${uvCall.joinUrl}" />
            </Connect>
        </Response>`;

        res.type('text/xml');
        return res.send(twiml);
        
    } catch (error) {
        console.error('[INBOUND ERROR]', error);
        res.status(500).send('Server Error');
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. OUTBOUND CALLING (React Dashboard triggers this)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/calls/outbound', async (req, res) => {
    const { toPhone, systemPrompt } = req.body;

    if (!twilioClient) {
        return res.status(500).json({ error: "Twilio credentials missing in backend." });
    }
    if (!toPhone) {
        return res.status(400).json({ error: "Missing 'toPhone' parameter." });
    }

    try {
        console.log(`[OUTBOUND] Creating AI agent to call ${toPhone}`);

        // 1. Pre-generate the Ultravox AI streaming URL
        const uvCall = await createUltravoxCall(systemPrompt);

        // 2. Write the TwiML response telling Twilio what to do as soon as the person answers
        const twiml = `<Response><Connect><Stream url="${uvCall.joinUrl}" /></Connect></Response>`;

        // 3. Command Twilio to dial out and inject the TwiML instantly
        const call = await twilioClient.calls.create({
            twiml: twiml,
            to: toPhone,
            from: TWILIO_PHONE_NUMBER
        });

        console.log(`[OUTBOUND] Twilio Ringing... Call SID: ${call.sid}`);
        return res.json({ success: true, callSid: call.sid, ultravoxCallId: uvCall.callId });

    } catch (error) {
        console.error('[OUTBOUND ERROR]', error);
        return res.status(500).json({ error: 'Failed to initiate outbound call', details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. HEALTH CHECK
// ─────────────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'SaaS Voice API is running!' });
});

app.listen(PORT, () => {
    console.log(`🚀 Backend SaaS API running on port ${PORT}`);
});
