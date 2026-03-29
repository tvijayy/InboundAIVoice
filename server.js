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
    res.json({ message: "Outbound AI trigger ready." });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Backend API running on port ${PORT}...`);
});
