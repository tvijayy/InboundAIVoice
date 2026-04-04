const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

// Friendly greeting for the root URL so the browser doesn't show an error
app.get('/', (req, res) => {
    res.send('✅ Azlon AI Backend is Live & Running!');
});

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

        // 1. Fetch Integration Keys from Database
        const { data: uvInt } = await supabase.from('integrations').select('*').eq('provider', 'ultravox').single();
        const ACTIVE_ULTRAVOX_KEY = uvInt?.api_key || process.env.ULTRAVOX_API_KEY;

        if (!ACTIVE_ULTRAVOX_KEY) {
            console.error("Ultravox API key is completely missing. Add it in the Dashboard's API Credentials page.");
            return res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>The AI agent is not configured.</Say></Response>`);
        }

        // 2. Check database for Custom System Prompt and settings
        const { data: agentData } = await supabase.from('agent_settings').select('*').limit(1).single();
        const fallbackPrompt = "You are the smart AI agent for Azlon AI Voice Platform. Keep answers extremely short, professional, and confident.";
        
        // 2.5 Load Knowledge Base automatically
        const { data: kbDocs } = await supabase.from('knowledge_base').select('content').eq('status', 'Active');
        let contextText = "";
        if (kbDocs && kbDocs.length > 0) {
            contextText = "\n\nCOMPANY KNOWLEDGE BASE (Use this to answer questions):\n" + kbDocs.map(k => k.content).join("\n---\n");
        }

        let finalPrompt = (agentData?.system_prompt || fallbackPrompt) + contextText;
        
        // Emphasize personality and rules
        if (agentData?.personality) finalPrompt += `\n\nYour Personality/Tone: ${agentData.personality}`;
        finalPrompt += "\n\nIMPORTANT INSTRUCTION: Call the 'log_call_outcome' tool when the conversation is naturally concluding to record sentiment and status.";

        // 3. Create a Call on Ultravox to get a secure WebSocket connect URL
        const uvResponse = await fetch('https://api.ultravox.ai/api/calls', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': ACTIVE_ULTRAVOX_KEY
            },
            body: JSON.stringify({
                systemPrompt: finalPrompt,
                voice: agentData?.voice_preset || "Mark",
                temperature: agentData?.temperature || 0.3,
                firstSpeaker: "FIRST_SPEAKER_AGENT", // Force the AI to say hello first!
                medium: { twilio: {} }, // CRITICAL: Tell Ultravox to use Twilio's audio stream format!
                selectedTools: [
                    {
                        temporaryTool: {
                            modelToolName: "check_availability",
                            description: "Check the calendar for free available time slots on a specific date to prevent double-booking.",
                            dynamicParameters: [
                                {
                                    name: "target_date",
                                    location: "PARAMETER_LOCATION_BODY",
                                    schema: { type: "string", description: "The target date to check in YYYY-MM-DD format" },
                                    required: true
                                }
                            ],
                            http: { httpMethod: "POST", baseUrlPattern: "https://saas-backend.xqnsvk.easypanel.host/api/tools/availability" }
                        }
                    },
                    {
                        temporaryTool: {
                            modelToolName: "book_appointment",
                            description: "Book an appointment for the caller on the calendar.",
                            dynamicParameters: [
                                {
                                    name: "start_time",
                                    location: "PARAMETER_LOCATION_BODY",
                                    schema: { type: "string", description: "ISO 8601 datetime string. e.g. 2026-10-04T10:00:00Z" },
                                    required: true
                                },
                                {
                                    name: "name",
                                    location: "PARAMETER_LOCATION_BODY",
                                    schema: { type: "string", description: "Full name of caller" },
                                    required: true
                                },
                                {
                                    name: "phone",
                                    location: "PARAMETER_LOCATION_BODY",
                                    schema: { type: "string", description: "Contact number" },
                                    required: false
                                }
                            ],
                            http: { httpMethod: "POST", baseUrlPattern: "https://saas-backend.xqnsvk.easypanel.host/api/tools/book" }
                        }
                    },
                    {
                        temporaryTool: {
                            modelToolName: "update_appointment",
                            description: "Reschedule or update an existing appointment to a new time. Requires caller verification.",
                            dynamicParameters: [
                                {
                                    name: "name",
                                    location: "PARAMETER_LOCATION_BODY",
                                    schema: { type: "string", description: "First and last name used originally" },
                                    required: true
                                },
                                {
                                    name: "phone",
                                    location: "PARAMETER_LOCATION_BODY",
                                    schema: { type: "string", description: "Phone number used originally" },
                                    required: true
                                },
                                {
                                    name: "new_start_time",
                                    location: "PARAMETER_LOCATION_BODY",
                                    schema: { type: "string", description: "ISO 8601 datetime string of the new desired time slot" },
                                    required: true
                                }
                            ],
                            http: { httpMethod: "POST", baseUrlPattern: "https://saas-backend.xqnsvk.easypanel.host/api/tools/update" }
                        }
                    },
                    {
                        temporaryTool: {
                            modelToolName: "delete_appointment",
                            description: "Cancel and delete an existing appointment. Strongly requires caller verification.",
                            dynamicParameters: [
                                {
                                    name: "name",
                                    location: "PARAMETER_LOCATION_BODY",
                                    schema: { type: "string", description: "First and last name used originally" },
                                    required: true
                                },
                                {
                                    name: "phone",
                                    location: "PARAMETER_LOCATION_BODY",
                                    schema: { type: "string", description: "Phone number used originally" },
                                    required: true
                                }
                            ],
                            http: { httpMethod: "POST", baseUrlPattern: "https://saas-backend.xqnsvk.easypanel.host/api/tools/delete" }
                        }
                    },
                    {
                        temporaryTool: {
                            modelToolName: "log_call_outcome",
                            description: "Evaluate the sentiment (Positive/Negative/Neutral) and the status (Resolved/Follow Up/Booked/Missed) right before hanging up.",
                            dynamicParameters: [
                                { name: "phone", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "The caller's exact phone number" }, required: true },
                                { name: "sentiment", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "Positive, Negative, or Neutral" }, required: true },
                                { name: "status", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "Resolved, Follow Up, Booked, or Missed" }, required: true }
                            ],
                            http: { httpMethod: "POST", baseUrlPattern: "https://saas-backend.xqnsvk.easypanel.host/api/tools/log_outcome" }
                        }
                    }
                ]
            })
        });

        const uvData = await uvResponse.json();
        if (!uvData.joinUrl) {
            console.error("Ultravox API failed to generate WebSocket:", uvData);
        }
        const joinUrl = uvData.joinUrl;
        const safeJoinUrl = joinUrl ? joinUrl.replace(/&/g, '&amp;') : '';
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
        <Stream url="${safeJoinUrl}">
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
        const { toPhone, systemPrompt, voice, goal } = req.body;
        if (!toPhone) return res.status(400).json({ error: "Missing toPhone parameter." });
        
        console.log(`Initiating Outbound Call to: ${toPhone}`);

        // 1. Check Twilio Credentials
        const { data: twInt } = await supabase.from('integrations').select('*').eq('provider', 'twilio').single();
        const TWILIO_SID = twInt?.meta_data?.sid || process.env.TWILIO_ACCOUNT_SID;
        const TWILIO_AUTH = twInt?.api_key || process.env.TWILIO_AUTH_TOKEN;
        const TWILIO_PHONE = twInt?.meta_data?.phone || process.env.TWILIO_PHONE_NUMBER;

        if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_PHONE) {
            return res.status(400).json({ error: "Twilio credentials missing. Set them in the Dashboard." });
        }

        const twilioClient = require('twilio')(TWILIO_SID, TWILIO_AUTH);
        
        // Use exact domain to prevent .env overrides from breaking Status Callback
        const serverBaseUrl = "https://saas-backend.xqnsvk.easypanel.host";
        const webhookUrl = `${serverBaseUrl}/api/twilio/outbound-twiml?toPhone=${encodeURIComponent(toPhone || '')}&voice=${encodeURIComponent(voice || '')}&goal=${encodeURIComponent(goal || '')}`;

        // 3. Directly command Twilio to physically dial the lead
        const call = await twilioClient.calls.create({
            url: webhookUrl,
            to: toPhone,
            from: TWILIO_PHONE,
            statusCallback: `${serverBaseUrl}/api/twilio/status`,
            statusCallbackEvent: ['completed']
        });

        // 4. SECURE LOGGING: Write the outbound call directly into your Supabase Data Table!
        await supabase.from('calls').insert([{
            direction: 'outbound',
            from_phone: TWILIO_PHONE,
            to_phone: toPhone,
            status: call.status,
            twilio_sid: call.sid
        }]);

        console.log(`Outbound Call Live - Status: ${call.status} - SID: ${call.sid}`);
        res.json({ success: true, callSid: call.sid, message: "Dialing the lead now!" });

    } catch (error) {
        console.error("Critical Outbound Dialing Error:", error);
        res.status(500).json({ error: error.message || "Failed to launch outbound API." });
    }
});

// Twilio Webhook (Hit exactly when the user presses the key on a trial account, or instantly on full accounts)
app.post('/api/twilio/outbound-twiml', async (req, res) => {
    try {
        const toPhone = req.query.toPhone;
        const reqVoice = req.query.voice;
        const reqGoal = req.query.goal;

        // 1. Fetch Ultravox Key
        const { data: uvInt } = await supabase.from('integrations').select('*').eq('provider', 'ultravox').single();
        const ACTIVE_ULTRAVOX_KEY = uvInt?.api_key || process.env.ULTRAVOX_API_KEY;

        if (!ACTIVE_ULTRAVOX_KEY) return res.status(500).send('<Response><Say>AI Key Error</Say></Response>');

        const { data: agentData } = await supabase.from('agent_settings').select('*').limit(1).single();
        
        const { data: kbDocs } = await supabase.from('knowledge_base').select('content').eq('status', 'Active');
        let contextText = "";
        if (kbDocs && kbDocs.length > 0) {
            contextText = "\n\nCOMPANY KNOWLEDGE BASE (Use this to answer questions):\n" + kbDocs.map(k => k.content).join("\n---\n");
        }

        let finalPrompt = (agentData?.system_prompt || "You are an outbound sales AI calling a lead. Be incredibly persuasive, warm, and brief.") + contextText;
        if (agentData?.personality) finalPrompt += `\n\nYour Personality/Tone: ${agentData.personality}`;
        if (reqGoal) finalPrompt += `\n\n[PRIMARY MISSION GOAL]: ${reqGoal}`;
        finalPrompt += "\n\nIMPORTANT INSTRUCTION: Call the 'log_call_outcome' tool when the conversation is naturally concluding to record sentiment and status.";

        const finalVoice = reqVoice || agentData?.voice_preset || "Mark";

        // 2. Create the Ultravox Session right now (no timeout risk because they just pressed the key!)
        const uvResponse = await fetch('https://api.ultravox.ai/api/calls', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': ACTIVE_ULTRAVOX_KEY
            },
            body: JSON.stringify({
                systemPrompt: finalPrompt,
                voice: finalVoice,
                temperature: agentData?.temperature || 0.3,
                firstSpeaker: "FIRST_SPEAKER_AGENT",
                firstSpeakerMessage: req.body.greeting || agentData?.greeting_message || undefined,
                medium: { twilio: {} },
                selectedTools: [
                    {
                        temporaryTool: {
                            modelToolName: "check_availability",
                            description: "Check the calendar for free available time slots on a specific date to prevent double-booking.",
                            dynamicParameters: [
                                {
                                    name: "target_date",
                                    location: "PARAMETER_LOCATION_BODY",
                                    schema: { type: "string", description: "The target date to check in YYYY-MM-DD format" },
                                    required: true
                                }
                            ],
                            http: { httpMethod: "POST", baseUrlPattern: "https://saas-backend.xqnsvk.easypanel.host/api/tools/availability" }
                        }
                    },
                    {
                        temporaryTool: {
                            modelToolName: "book_appointment",
                            description: "Book an appointment for the caller on the calendar.",
                            dynamicParameters: [
                                {
                                    name: "start_time",
                                    location: "PARAMETER_LOCATION_BODY",
                                    schema: { type: "string", description: "ISO 8601 datetime string. e.g. 2026-10-04T10:00:00Z" },
                                    required: true
                                },
                                {
                                    name: "name",
                                    location: "PARAMETER_LOCATION_BODY",
                                    schema: { type: "string", description: "Full name of caller" },
                                    required: true
                                },
                                {
                                    name: "phone",
                                    location: "PARAMETER_LOCATION_BODY",
                                    schema: { type: "string", description: "Contact number" },
                                    required: false
                                }
                            ],
                            http: { httpMethod: "POST", baseUrlPattern: "https://saas-backend.xqnsvk.easypanel.host/api/tools/book" }
                        }
                    },
                    {
                        temporaryTool: {
                            modelToolName: "log_call_outcome",
                            description: "Evaluate the sentiment (Positive/Negative/Neutral) and the status (Resolved/Follow Up/Booked/Missed) right before hanging up.",
                            dynamicParameters: [
                                { name: "phone", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "The caller's exact phone number" }, required: true },
                                { name: "sentiment", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "Positive, Negative, or Neutral" }, required: true },
                                { name: "status", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "Resolved, Follow Up, Booked, or Missed" }, required: true }
                            ],
                            http: { httpMethod: "POST", baseUrlPattern: "https://saas-backend.xqnsvk.easypanel.host/api/tools/log_outcome" }
                        }
                    }
                ]
            })
        });

        const uvData = await uvResponse.json();
        const joinUrl = uvData.joinUrl;
        
        if (!joinUrl) {
            console.error("Ultravox API failed:", uvData);
            const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Ultravox API Error: ${JSON.stringify(uvData).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')}</Say>
</Response>`;
            res.set('Content-Type', 'text/xml');
            return res.send(errorTwiml);
        }

        const safeJoinUrl = joinUrl.replace(/&/g, '&amp;');
        const ultravoxCallId = uvData.callId;

        // 3. Connect the Ultravox ID back to the original call
        const callSid = req.body.CallSid;
        if (callSid) {
            await supabase.from('calls').update({ ultravox_call_id: ultravoxCallId }).eq('twilio_sid', callSid);
        }

        // 4. Return TwiML
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="${safeJoinUrl}">
            <Parameter name="myCustomMetadata" value="Outbound Sales Call"/>
        </Stream>
    </Connect>
</Response>`;

        res.set('Content-Type', 'text/xml');
        res.send(twiml);

    } catch (err) {
        console.error("Outbound TwiML Webhook Error:", err);
        res.status(500).send('<Response><Say>Error loading AI.</Say></Response>');
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

                // Fetch Key
                const { data: uvInt } = await supabase.from('integrations').select('*').eq('provider', 'ultravox').single();
                const ACTIVE_ULTRAVOX_KEY = uvInt?.api_key || process.env.ULTRAVOX_API_KEY;

                // Fetch data from Ultravox
                const uvRes = await fetch(`https://api.ultravox.ai/api/calls/${callRow.ultravox_call_id}`, {
                    headers: { 'X-API-Key': ACTIVE_ULTRAVOX_KEY }
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
        
        let { data: agentData } = await supabase.from('agent_settings').select('*').limit(1).single();
        if (!agentData) {
             agentData = { working_days: ["Mon", "Tue", "Wed", "Thu", "Fri"], open_time: '09:00', close_time: '18:00', non_working_dates: [] };
        }
        
        const targetDateObj = new Date(target_date + 'T12:00:00Z');
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const targetDayName = days[targetDateObj.getUTCDay()];
        
        // 1. Check if date is manually blocked
        const nonWorkingDates = agentData.non_working_dates || [];
        if (nonWorkingDates.includes(target_date)) {
            return res.json({ available_slots: "Business is closed on this specific date." });
        }
        
        // 2. Check if day of week is supported
        const workingDays = Array.isArray(agentData.working_days) ? agentData.working_days : ["Mon", "Tue", "Wed", "Thu", "Fri"];
        if (!workingDays.includes(targetDayName)) {
            return res.json({ available_slots: "Business is closed on " + targetDayName + "s." });
        }
        
        // 3. Generate all possible slots (1 hour intervals for simplicity)
        let openHour = parseInt((agentData.open_time || '09:00').split(':')[0]);
        let closeHour = parseInt((agentData.close_time || '18:00').split(':')[0]);
        
        let allSlots = [];
        for (let h = openHour; h < closeHour; h++) {
            let hourStr = h.toString().padStart(2, '0') + ":00:00.000Z";
            allSlots.push(`${target_date}T${hourStr}`);
        }
        
        // 4. Fetch existing appointments for that day to find conflicts
        const { data: existingApps } = await supabase
            .from('appointments')
            .select('start_time')
            .gte('start_time', `${target_date}T00:00:00Z`)
            .lte('start_time', `${target_date}T23:59:59Z`);
            
        let bookedSlots = existingApps ? existingApps.map(a => new Date(a.start_time).toISOString()) : [];
        let freeSlots = allSlots.filter(slot => !bookedSlots.includes(slot));
        
        res.json({ available_slots: freeSlots.length > 0 ? freeSlots : "No free slots on this date." });
    } catch (e) {
        console.error("Availability Check Error:", e);
        res.json({ available_slots: "Error retrieving slots." });
    }
});

app.post('/api/tools/book', async (req, res) => {
    try {
        const { start_time, name, phone } = req.body;
        console.log("Ultravox AI triggered book_appointment:", req.body);
        
        const startDate = new Date(start_time);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration
        
        await supabase.from('appointments').insert([{ 
            name: name || "AI Caller", 
            phone: phone || "", 
            start_time: startDate.toISOString(), 
            end_time: endDate.toISOString(),
            status: 'Confirmed'
        }]);
        res.json({ result: "Appointment officially booked into the internal system!" });
    } catch(err) {
        console.error("Booking Error:", err);
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

app.post('/api/tools/log_outcome', async (req, res) => {
    try {
        const { phone, sentiment, status } = req.body;
        console.log("Ultravox AI triggered log_call_outcome for:", phone, sentiment, status);
        
        // Find the most recent active or completed call for this phone number
        const { data: calls } = await supabase
            .from('calls')
            .select('id, to_phone, from_phone')
            .or(`from_phone.eq.${phone},to_phone.eq.${phone}`)
            .order('created_at', { ascending: false })
            .limit(1);

        if (calls && calls.length > 0) {
            await supabase.from('calls').update({ sentiment, call_status: status }).eq('id', calls[0].id);
        }
        
        res.json({ result: "Outcome logged successfully." });
    } catch(err) {
        console.error("Error logging outcome:", err);
        res.status(500).json({ result: "Failed to log outcome" });
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

// Sync ALL existing Cal.com bookings into our Supabase dashboard
app.post('/api/appointments/sync', async (req, res) => {
    try {
        const { data: cal } = await supabase.from('integrations').select('*').eq('provider', 'calcom').single();
        if (!cal || !cal.api_key) return res.status(400).json({ error: "Cal.com API key not configured. Please save it in the Calendar settings first." });

        // Fetch all upcoming bookings from Cal.com
        const calRes = await fetch(`https://api.cal.com/v1/bookings?apiKey=${cal.api_key}&status=upcoming`, {
            headers: { 'Content-Type': 'application/json' }
        });
        const calData = await calRes.json();

        if (!calRes.ok) {
            return res.status(400).json({ error: `Cal.com API error: ${calData.message || JSON.stringify(calData)}` });
        }

        const bookings = calData.bookings || [];
        let synced = 0;

        for (const booking of bookings) {
            const attendee = booking.attendees?.[0] || {};
            const bookingUid = booking.uid;
            const startTime = booking.startTime;
            const name = attendee.name || booking.title || 'Unknown';
            const phone = attendee.phoneNumber || '';

            // Check if we already have this booking in Supabase (avoid duplicates)
            const { data: existing } = await supabase.from('appointments').select('id').eq('booking_uid', bookingUid).single();
            if (!existing) {
                await supabase.from('appointments').insert([{
                    name, phone, start_time: startTime,
                    booking_uid: bookingUid,
                    source: 'calcom_sync',
                    status: booking.status || 'confirmed'
                }]);
                synced++;
            }
        }

        res.json({ success: true, message: `Sync complete. ${synced} new bookings imported from Cal.com. Total in Cal.com: ${bookings.length}.` });
    } catch(err) {
        console.error('Cal.com sync error:', err);
        res.status(500).json({ error: err.message || "Sync failed." });
    }
});

// --- ADVANCED CRM ENDPOINTS ---

app.get('/api/leads', async (req, res) => {
    try {
        const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, leads: data || [] });
    } catch(err) {
        res.status(500).json({ error: "API Failure" });
    }
});

app.post('/api/leads', async (req, res) => {
    try {
        const { name, phone, email, ai_context, segment, source } = req.body;
        const { data } = await supabase.from('leads').insert([{ name, phone, email, ai_context, segment, source }]).select();
        res.json({ success: true, lead: data[0] });
    } catch(err) {
        res.status(500).json({ error: "API Failure" });
    }
});

app.get('/api/knowledge_base', async (req, res) => {
    try {
        const { data, error } = await supabase.from('knowledge_base').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, docs: data || [] });
    } catch(err) {
        res.status(500).json({ error: "API Failure" });
    }
});

app.post('/api/knowledge_base', async (req, res) => {
    try {
        const { title, content } = req.body;
        const { data } = await supabase.from('knowledge_base').insert([{ title, content, status: 'Active' }]).select();
        res.json({ success: true, doc: data[0] });
    } catch(err) {
        res.status(500).json({ error: "API Failure" });
    }
});

app.delete('/api/knowledge_base/:id', async (req, res) => {
    try {
        await supabase.from('knowledge_base').delete().eq('id', req.params.id);
        res.json({ success: true });
    } catch(err) {
        res.status(500).json({ error: "API Failure" });
    }
});

app.get('/api/campaigns', async (req, res) => {
    try {
        const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, campaigns: data || [] });
    } catch(err) {
        res.status(500).json({ error: "API Failure" });
    }
});

app.post('/api/campaigns', async (req, res) => {
    try {
        const { name, total_calls, goal } = req.body;
        const { data } = await supabase.from('campaigns').insert([{ name, total_calls, goal, status: 'running' }]).select();
        res.json({ success: true, campaign: data[0] });
    } catch(err) {
        res.status(500).json({ error: "API Failure" });
    }
});

app.get('/api/reports', async (req, res) => {
    try {
        const { data: calls } = await supabase.from('calls').select('*');
        const { data: leads } = await supabase.from('leads').select('id');
        const { data: apps } = await supabase.from('appointments').select('*');

        const totalCalls = calls ? calls.length : 0;
        const totalDuration = calls ? calls.reduce((acc, c) => acc + parseInt(c.duration_seconds || 0), 0) : 0;
        
        let positive = 0; let negative = 0; let neutral = 0;

        if (calls) {
            calls.forEach(c => {
                const s = (c.sentiment || '').toLowerCase();
                if (s === 'positive') positive++;
                else if (s === 'negative') negative++;
                else neutral++;
            });
        }

        res.json({ 
            success: true, 
            metrics: {
                totalCalls,
                inboundCalls: calls ? calls.filter(c => c.direction === 'inbound').length : 0,
                outboundCalls: calls ? calls.filter(c => c.direction === 'outbound').length : 0,
                totalMinutes: Math.floor(totalDuration / 60) || 0,
                sentiment: { positive, negative, neutral },
                totalLeads: leads ? leads.length : 0,
                bookedAppointments: apps ? apps.length : 0
            }
        });
    } catch (err) {
        console.error("Reports API Error:", err);
        res.status(500).json({ error: "Could not generate reports." });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Backend API running on port ${PORT}...`);
});
