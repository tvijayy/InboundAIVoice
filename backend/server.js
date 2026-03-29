const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

const PORT = 8000;
const ULTRAVOX_API_KEY = process.env.ULTRAVOX_API_KEY;

// Initialize Supabase Database Engine
const supabase = createClient(
    process.env.SUPABASE_URL || 'https://dummy.supabase.co',
    process.env.SUPABASE_KEY || 'dummy_key'
);

// Inbound webhook from Twilio
app.post('/api/twilio/inbound', async (req, res) => {
    try {
        const callerPhone = req.body.From || "Unknown";
        const twilioPhone = req.body.To || "Unknown";
        const callSid = req.body.CallSid || "No_SID";
        console.log(`Inbound Call Received from: ${callerPhone}`);

        // 1. Check database for Custom System Prompt
        const { data: agentData } = await supabase.from('agent_settings').select('*').limit(1).single();
        const fallbackPrompt = "You are the smart AI agent for RapidX SaaS. Keep answers extremely short, professional, and confident.";
        const finalPrompt = agentData?.system_prompt || fallbackPrompt;

        // 1. Create a Call on Ultravox to get a secure WebSocket connect URL
        const uvResponse = await fetch('https://api.ultravox.ai/api/calls', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': ULTRAVOX_API_KEY
            },
            body: JSON.stringify({
                systemPrompt: finalPrompt,
                voice: agentData?.voice_preset || "Mark",
                temperature: agentData?.temperature || 0.3,
                firstSpeaker: "FIRST_SPEAKER_AGENT", // Force the AI to say hello first!
                medium: { twilio: {} } // CRITICAL: Tell Ultravox to use Twilio's audio stream format!
            })
        });

        const uvData = await uvResponse.json();
        // If Ultravox rejected our API call, the joinUrl will crash the Twilio stream silently.
        if (!uvData.joinUrl) {
            console.error("Ultravox API failed to generate WebSocket:", uvData);
        }
        const joinUrl = uvData.joinUrl;

        // 3. SECURE LOGGING: Save the call instantly directly into your Supabase Database
        await supabase.from('calls').insert([{
            direction: 'inbound',
            from_phone: callerPhone,
            to_phone: twilioPhone,
            status: 'active',
            twilio_sid: callSid
        }]);

        // 4. Return Twilio XML (TwiML) instantly bridging the caller to the Ultravox WebSocket
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="${joinUrl}">
            <Parameter name="myCustomMetadata" value="InboundCall"/>
        </Stream>
    </Connect>
</Response>`;

        res.set('Content-Type', 'text/xml');
        res.send(twiml);
        console.log("Audio Stream successfully relayed to Ultravox!");

    } catch (error) {
        console.error("Ultravox Connection Error:", error);
        res.status(500).send("Error connecting AI Agent");
    }
});

// Outbound trigger endpoint (For the React Dashboard)
app.post('/api/calls/outbound', async (req, res) => {
    try {
        const { toPhone, systemPrompt } = req.body;
        if (!toPhone) return res.status(400).json({ error: "Missing toPhone parameter." });
        
        console.log(`Initiating Outbound Call to: ${toPhone}`);

        // 1. Create a specialized Outbound Ultravox session to construct the secure audio WebSocket
        const uvResponse = await fetch('https://api.ultravox.ai/api/calls', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': ULTRAVOX_API_KEY
            },
            body: JSON.stringify({
                systemPrompt: systemPrompt || "You are an outbound sales AI calling a lead. Be incredibly persuasive, warm, and brief.",
                voice: "Mark", // You can change this voice dynamically
                temperature: 0.3,
                firstSpeaker: "FIRST_SPEAKER_AGENT", // Agent speaks first!
                medium: { twilio: {} } // CRITICAL: Tell Ultravox to use Twilio's audio stream format!
            })
        });

        const uvData = await uvResponse.json();
        if (!uvData.joinUrl) {
            console.error("Ultravox API failed to generate Outbound WebSocket:", uvData);
        }
        const joinUrl = uvData.joinUrl;

        // 2. Format the inline TwiML XML payload 
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="${joinUrl}">
            <Parameter name="myCustomMetadata" value="Outbound Sales Call"/>
        </Stream>
    </Connect>
</Response>`;

        // 3. Directly command Twilio to physically dial the lead utilizing the SDK
        const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        
        const call = await twilioClient.calls.create({
            twiml: twiml,
            to: toPhone,
            from: process.env.TWILIO_PHONE_NUMBER
        });

        console.log(`Outbound Call Live - Status: ${call.status} - SID: ${call.sid}`);
        res.json({ success: true, callSid: call.sid, message: "Dialing the lead now!" });

    } catch (error) {
        console.error("Critical Outbound Dialing Error:", error);
        res.status(500).json({ error: error.message || "Failed to launch outbound API." });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Backend API running on port ${PORT}...`);
});
