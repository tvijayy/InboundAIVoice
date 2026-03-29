const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.urlencoded({ extended: true })); // Required for Twilio Webhooks
app.use(express.json());
app.use(cors());

const PORT = 8000;
const ULTRAVOX_API_KEY = process.env.ULTRAVOX_API_KEY;

// Inbound webhook from Twilio
app.post('/api/twilio/inbound', async (req, res) => {
    try {
        console.log("Inbound Call Received from:", req.body.From);

        // 1. Create a Call on Ultravox to get a secure WebSocket connect URL
        const uvResponse = await fetch('https://api.ultravox.ai/api/calls', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': ULTRAVOX_API_KEY
            },
            body: JSON.stringify({
                systemPrompt: "You are the smart AI agent for RapidX SaaS. Keep answers extremely short, professional, and confident.",
                model: "fixie-ai/ultravox-70B",
                voice: "Mark",
                temperature: 0.3
            })
        });

        const uvData = await uvResponse.json();
        const joinUrl = uvData.joinUrl;

        // 2. Return Twilio XML (TwiML) instantly bridging the caller to the Ultravox WebSocket
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
                model: "fixie-ai/ultravox-70B",
                voice: "Mark", // You can change this voice dynamically
                temperature: 0.3
            })
        });

        const uvData = await uvResponse.json();
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
