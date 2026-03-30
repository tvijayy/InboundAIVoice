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
        const fallbackPrompt = "You are the smart AI agent for Azlon AI Voice Platform. Keep answers extremely short, professional, and confident.";
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
        if (!uvData.joinUrl) {
            console.error("Ultravox API failed to generate WebSocket:", uvData);
        }
        const joinUrl = uvData.joinUrl;
        const ultravoxCallId = uvData.callId; // CAPTURE FOR SUMMARIES!

        // 3. SECURE LOGGING: Save the call instantly directly into your Supabase Database
        await supabase.from('calls').insert([{
            direction: 'inbound',
            from_phone: callerPhone,
            to_phone: twilioPhone,
            status: 'active',
            twilio_sid: callSid,
            ultravox_call_id: ultravoxCallId
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
        const ultravoxCallId = uvData.callId;

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
            from: process.env.TWILIO_PHONE_NUMBER,
            statusCallback: 'https://saas-backend.xqnsvk.easypanel.host/api/twilio/status', // Tell Twilio to hit our server when call drops!
            statusCallbackEvent: ['completed']
        });

        // SECURE LOGGING: Write the outbound call directly into your Supabase Data Table!
        await supabase.from('calls').insert([{
            direction: 'outbound',
            from_phone: process.env.TWILIO_PHONE_NUMBER,
            to_phone: toPhone,
            status: call.status,
            twilio_sid: call.sid,
            ultravox_call_id: ultravoxCallId
        }]);

        console.log(`Outbound Call Live - Status: ${call.status} - SID: ${call.sid}`);
        res.json({ success: true, callSid: call.sid, message: "Dialing the lead now!" });

    } catch (error) {
        console.error("Critical Outbound Dialing Error:", error);
        res.status(500).json({ error: error.message || "Failed to launch outbound API." });
    }
});

// Fetch Call Logs mapping for the React Dashboard!
app.get('/api/calls', async (req, res) => {
    try {
        const { data: calls, error } = await supabase
            .from('calls')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
            
        if (error) throw error;
        res.json({ success: true, calls });
    } catch (err) {
        console.error("Dashboard Fetch Error:", err);
        res.status(500).json({ error: "Could not fetch database." });
    }
});

// GET Agent Settings from Dashboard
app.get('/api/agent', async (req, res) => {
    try {
        let { data: agentData, error } = await supabase.from('agent_settings').select('*').limit(1).single();
        if (error || !agentData) {
            // Provide a default structure if table is empty
            agentData = { system_prompt: "You are an AI assistant.", voice_preset: "Mark", temperature: 0.3 };
        }
        res.json({ success: true, agent: agentData });
    } catch (err) {
        res.status(500).json({ error: "Could not fetch agent settings." });
    }
});

// POST Agent Settings from Dashboard (Saving updates!)
app.post('/api/agent', async (req, res) => {
    try {
        const { system_prompt, voice_preset, temperature } = req.body;
        
        // Upsert to the first basic row
        const { data: existing } = await supabase.from('agent_settings').select('id').limit(1).single();
        
        if (existing && existing.id) {
            await supabase.from('agent_settings').update({ system_prompt, voice_preset, temperature }).eq('id', existing.id);
        } else {
            await supabase.from('agent_settings').insert([{ system_prompt, voice_preset, temperature }]);
        }
        
        res.json({ success: true, message: "Agent successfully updated globally!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not save agent settings." });
    }
});

// Twilio Call Status Webhook (Hangs up, fetches Summary from Ultravox!)
app.post('/api/twilio/status', async (req, res) => {
    const callSid = req.body.CallSid;
    const callDuration = req.body.CallDuration || 0;
    const callStatus = req.body.CallStatus; // 'completed'

    console.log(`Call Ended: ${callSid}. Waiting 5 seconds for Ultravox to generate Summary...`);
    res.sendStatus(200); // Instantly reply to Twilio so it drops the connection cleanly.

    // Background process: wait 8 seconds to ensure LLM has generated transcript/summary
    if (callStatus === 'completed') {
        setTimeout(async () => {
            try {
                // Find mapping row
                const { data: callRow } = await supabase.from('calls').select('ultravox_call_id').eq('twilio_sid', callSid).single();
                if (!callRow || !callRow.ultravox_call_id) return;

                // Fetch data from Ultravox
                const uvRes = await fetch(`https://api.ultravox.ai/api/calls/${callRow.ultravox_call_id}`, {
                    headers: { 'X-API-Key': ULTRAVOX_API_KEY }
                });
                const uvData = await uvRes.json();

                // Save to Supabase
                await supabase.from('calls').update({
                    status: 'completed',
                    duration_seconds: callDuration,
                    ai_summary: uvData.summary || "No summary available.",
                    transcript: "Feature pending native Ultravox messages mapping."
                }).eq('twilio_sid', callSid);
                
                console.log(`Successfully saved AI Summary for Call: ${callSid}`);
            } catch (err) {
                console.error("Failed capturing AI Summary in background:", err);
            }
        }, 8000); // 8 second buffer
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Backend API running on port ${PORT}...`);
});
