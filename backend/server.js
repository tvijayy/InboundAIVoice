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
                medium: { twilio: {} }, // CRITICAL: Tell Ultravox to use Twilio's audio stream format!
                selectedTools: [
                    {
                        toolName: "check_availability",
                        toolDefinition: {
                            description: "Check the calendar for free available time slots on a specific date to prevent double-booking.",
                            parameters: {
                                type: "object",
                                properties: { target_date: { type: "string", description: "The target date to check in YYYY-MM-DD format" } },
                                required: ["target_date"]
                            }
                        },
                        http: { method: "POST", baseUrlPattern: process.env.SERVER_BASE_URL || "https://saas-backend.xqnsvk.easypanel.host/api/tools/availability" }
                    },
                    {
                        toolName: "book_appointment",
                        toolDefinition: {
                            description: "Book an appointment for the caller on the calendar.",
                            parameters: {
                                type: "object",
                                properties: {
                                    start_time: { type: "string", description: "ISO 8601 datetime string. e.g. 2026-10-04T10:00:00Z" },
                                    name: { type: "string", description: "Full name of caller" },
                                    phone: { type: "string", description: "Contact number" }
                                },
                                required: ["start_time", "name"]
                            }
                        },
                        http: { method: "POST", baseUrlPattern: process.env.SERVER_BASE_URL || "https://saas-backend.xqnsvk.easypanel.host/api/tools/book" }
                    },
                    {
                        toolName: "update_appointment",
                        toolDefinition: {
                            description: "Reschedule or update an existing appointment to a new time. Requires caller verification.",
                            parameters: {
                                type: "object",
                                properties: {
                                    name: { type: "string", description: "First and last name used originally" },
                                    phone: { type: "string", description: "Phone number used originally" },
                                    new_start_time: { type: "string", description: "ISO 8601 datetime string of the new desired time slot" }
                                },
                                required: ["name", "phone", "new_start_time"]
                            }
                        },
                        http: { method: "POST", baseUrlPattern: process.env.SERVER_BASE_URL || "https://saas-backend.xqnsvk.easypanel.host/api/tools/update" }
                    },
                    {
                        toolName: "delete_appointment",
                        toolDefinition: {
                            description: "Cancel and delete an existing appointment. Strongly requires caller verification.",
                            parameters: {
                                type: "object",
                                properties: {
                                    name: { type: "string", description: "First and last name used originally" },
                                    phone: { type: "string", description: "Phone number used originally" }
                                },
                                required: ["name", "phone"]
                            }
                        },
                        http: { method: "POST", baseUrlPattern: process.env.SERVER_BASE_URL || "https://saas-backend.xqnsvk.easypanel.host/api/tools/delete" }
                    }
                ]
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
                medium: { twilio: {} }, // CRITICAL: Tell Ultravox to use Twilio's audio stream format!
                selectedTools: [
                    {
                        toolName: "check_availability",
                        toolDefinition: {
                            description: "Check the calendar for free available time slots on a specific date to prevent double-booking.",
                            parameters: {
                                type: "object",
                                properties: { target_date: { type: "string", description: "The target date to check in YYYY-MM-DD format" } },
                                required: ["target_date"]
                            }
                        },
                        http: { method: "POST", baseUrlPattern: process.env.SERVER_BASE_URL || "https://saas-backend.xqnsvk.easypanel.host/api/tools/availability" }
                    },
                    {
                        toolName: "book_appointment",
                        toolDefinition: {
                            description: "Book an appointment for the caller on the calendar.",
                            parameters: {
                                type: "object",
                                properties: {
                                    start_time: { type: "string", description: "ISO 8601 datetime string. e.g. 2026-10-04T10:00:00Z" },
                                    name: { type: "string", description: "Full name of caller" },
                                    phone: { type: "string", description: "Contact number" }
                                },
                                required: ["start_time", "name"]
                            }
                        },
                        http: { method: "POST", baseUrlPattern: process.env.SERVER_BASE_URL || "https://saas-backend.xqnsvk.easypanel.host/api/tools/book" }
                    }
                ]
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

// CRM Contacts Endpoints
app.get('/api/contacts', async (req, res) => {
    try {
        const { data: contacts, error } = await supabase
            .from('contacts')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, contacts });
    } catch (err) {
        res.status(500).json({ error: "Could not fetch contacts." });
    }
});

app.post('/api/contacts', async (req, res) => {
    try {
        const { name, phone_number, email, notes } = req.body;
        const { data, error } = await supabase
            .from('contacts')
            .insert([{ name, phone_number, email, notes }])
            .select();
        if (error) throw error;
        res.json({ success: true, contact: data[0] });
    } catch (err) {
        res.status(500).json({ error: err.message || "Could not save contact." });
    }
});

app.delete('/api/contacts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('contacts').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Could not delete contact." });
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

app.get('/api/integrations', async (req, res) => {
    try {
        const { data: integrations, error } = await supabase.from('integrations').select('*');
        if (error) {
            // Table might not exist yet, return empty
            return res.json({ success: true, integrations: [] });
        }
        res.json({ success: true, integrations });
    } catch (err) {
        res.status(500).json({ error: "Could not fetch integrations." });
    }
});

app.post('/api/integrations', async (req, res) => {
    try {
        const { provider, api_key, meta_data } = req.body;
        
        // Upsert logic for integrations based on provider
        const { data: existing } = await supabase.from('integrations').select('id').eq('provider', provider).single();
        
        if (existing && existing.id) {
            await supabase.from('integrations').update({ api_key, meta_data }).eq('id', existing.id);
        } else {
            await supabase.from('integrations').insert([{ provider, api_key, meta_data }]);
        }
        
        res.json({ success: true, message: "Integration updated successfully!" });
    } catch (err) {
        res.status(500).json({ error: "Could not save integration." });
    }
});

app.post('/api/tools/availability', async (req, res) => {
    try {
        const { target_date } = req.body;
        console.log("Ultravox AI triggered check_availability for:", target_date);
        const { data: cal } = await supabase.from('integrations').select('*').eq('provider', 'calcom').single();
        if (!cal || !cal.api_key) return res.json({ available_slots: "Calendar not configured." });

        const eventTypeId = cal.meta_data?.eventId || 123456;
        const response = await fetch(`https://api.cal.com/v1/slots?apiKey=${cal.api_key}&eventTypeId=${eventTypeId}&startTime=${target_date}T00:00:00.000Z&endTime=${target_date}T23:59:59.000Z`);
        const data = await response.json();
        
        let freeSlots = [];
        if (data && data.data && data.data.slots && data.data.slots[target_date]) {
             freeSlots = data.data.slots[target_date].map(s => s.time);
        }
        res.json({ available_slots: freeSlots.length > 0 ? freeSlots : "No free slots on this date." });
    } catch (e) {
        console.error(e);
        res.json({ available_slots: "Error retrieving slots." });
    }
});

app.post('/api/tools/book', async (req, res) => {
    try {
        const { start_time, name, phone } = req.body;
        console.log("Ultravox AI triggered book_appointment:", req.body);
        let bookingUid = null;

        const { data: cal } = await supabase.from('integrations').select('*').eq('provider', 'calcom').single();
        if (cal && cal.api_key) {
            const eventTypeId = cal.meta_data?.eventId || 123456;
            try {
                const response = await fetch(`https://api.cal.com/v1/bookings?apiKey=${cal.api_key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        eventTypeId: parseInt(eventTypeId),
                        start: start_time,
                        responses: { name: name || "AI Caller", email: "placeholder@ai.com", phone: phone || "" },
                        metadata: {},
                        timeZone: "America/New_York",
                        language: "en"
                    })
                });
                const responseData = await response.json();
                if (responseData && responseData.booking && responseData.booking.uid) {
                    bookingUid = responseData.booking.uid;
                }
            } catch (e) {
                console.error("Cal.com physical upstream failed but saving locally anyway", e);
            }
        }

        // Sync to Supabase Dashboard immediately
        await supabase.from('appointments').insert([{ name, phone, start_time, booking_uid: bookingUid }]);
        res.json({ result: "Appointment officially booked!" });
    } catch(err) {
        console.error(err);
        res.status(500).json({ result: "Failed to book appointment" });
    }
});

app.post('/api/tools/update', async (req, res) => {
    try {
        const { name, phone, new_start_time } = req.body;
        console.log("Ultravox AI triggered update_appointment:", req.body);

        const { data: appointments, error } = await supabase.from('appointments').select('*').ilike('name', `%${name}%`).eq('phone', phone);
        if (error || !appointments || appointments.length === 0) {
            return res.json({ result: "Authentication failed. Name and phone do not match any existing appointment. Ask them to verify their information." });
        }

        const target = appointments[0]; 
        
        await supabase.from('appointments').update({ start_time: new_start_time }).eq('id', target.id);
        
        res.json({ result: "Appointment successfully rescheduled." });
    } catch(err) {
        res.status(500).json({ result: "Failed to update appointment" });
    }
});

app.post('/api/tools/delete', async (req, res) => {
    try {
        const { name, phone } = req.body;
        console.log("Ultravox AI triggered delete_appointment:", req.body);

        const { data: appointments, error } = await supabase.from('appointments').select('*').ilike('name', `%${name}%`).eq('phone', phone);
        if (error || !appointments || appointments.length === 0) {
            return res.json({ result: "Authentication failed. Name and phone do not match any existing appointment. Ask them to verify their information." });
        }

        const target = appointments[0];

        const { data: cal } = await supabase.from('integrations').select('*').eq('provider', 'calcom').single();
        if (cal && cal.api_key && target.booking_uid) {
             try {
                 await fetch(`https://api.cal.com/v1/bookings/${target.booking_uid}/cancel?apiKey=${cal.api_key}`, {
                     method: 'DELETE',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ reason: "Caller requested cancellation via AI" })
                 });
             } catch(e) { }
        }

        await supabase.from('appointments').delete().eq('id', target.id);
        res.json({ result: "Appointment officially cancelled and removed from the calendar." });
    } catch(err) {
        res.status(500).json({ result: "Failed to delete appointment" });
    }
});

app.get('/api/appointments', async (req, res) => {
    try {
        const { data: appointments, error } = await supabase.from('appointments').select('*').order('start_time', { ascending: true });
        if (error) return res.json({ success: true, appointments: [] });
        res.json({ success: true, appointments });
    } catch(err) {
        res.status(500).json({ error: "API Failure" });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Backend API running on port ${PORT}...`);
});
