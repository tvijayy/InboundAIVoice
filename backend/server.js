const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
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
        
        const nowIST = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const todayISO = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        
        finalPrompt += `\n\nCALENDAR CONTEXT: You operate strictly in IST (UTC+05:30). 
        Current detailed time is ${nowIST}. 
        Today's ISO date is ${todayISO}.
        
        STRICT RULES:
        1. ALWAYS call 'check_availability' before suggest ANY time to a caller.
        2. DO NOT book appointments outside of the business hours or on holidays listed in the calendar.
        3. When booking, ALWAYS use the +05:30 offset in ISO format (Example: 2026-04-08T15:00:00+05:30 for 3 PM IST).
        4. If a caller asks to update or cancel, you MUST verify their details using the 'appointments' list provided in context.`;
        
        // Emphasize personality and rules
        if (agentData?.personality) finalPrompt += `\n\nYour Personality/Tone: ${agentData.personality}`;
        finalPrompt += "\n\nULTRA-IMPORTANT - EMOTIONAL EVALUATION: Monitor the user's mood constantly. If they express strong frustration, anger, or extreme satisfaction, you MUST call 'log_call_outcome' IMMEDIATELY during the call while they are still on the line. Use a short descriptive phrase for 'sentiment' (e.g. 'Angry and frustrated with previous service', 'Extremely interested in booking') and choose the corresponding 'category' (Positive, Negative, or Neutral).";

        // Force https for Ultravox tool callbacks as required by their API
        const baseUrl = `https://${req.get('host')}`;
        console.log(`[Ultravox] Creating session with tools at: ${baseUrl}`);
        
        const rawVoice = agentData?.voice_preset || "Mark";
        const validVoices = ["Alice", "Jessica", "Kelsey", "Priya", "Lulu", "Mark", "Victor", "Vitya", "Zdenek"];
        const finalVoice = validVoices.includes(rawVoice) ? rawVoice : "Mark";

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
                medium: { twilio: {} },
                selectedTools: [
                    {
                        temporaryTool: {
                            modelToolName: "check_availability",
                            description: "Check the calendar for free available time slots on a specific date (YYYY-MM-DD).",
                            dynamicParameters: [
                                {
                                    name: "target_date",
                                    location: "PARAMETER_LOCATION_BODY",
                                    schema: { type: "string", description: "Target date in YYYY-MM-DD" },
                                    required: true
                                }
                            ],
                            http: { httpMethod: "POST", baseUrlPattern: `${baseUrl}/api/tools/availability` }
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
                                    schema: { type: "string", description: "ISO 8601 datetime string. e.g. 2026-04-08T15:00:00+05:30" },
                                    required: true
                                },
                                {
                                    name: "name",
                                    location: "PARAMETER_LOCATION_BODY",
                                    schema: { type: "string", description: "Full name" },
                                    required: true
                                },
                                {
                                    name: "phone",
                                    location: "PARAMETER_LOCATION_BODY",
                                    schema: { type: "string", description: "Phone number" },
                                    required: false
                                }
                            ],
                            http: { httpMethod: "POST", baseUrlPattern: `${baseUrl}/api/tools/book` }
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
                            http: { httpMethod: "POST", baseUrlPattern: `${baseUrl}/api/tools/update` }
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
                            http: { httpMethod: "POST", baseUrlPattern: `${baseUrl}/api/tools/delete` }
                        }
                    },
                    {
                        temporaryTool: {
                            modelToolName: "log_call_outcome",
                            description: "Record the final outcome of the call including a descriptive sentiment word and its overall category.",
                            dynamicParameters: [
                                { name: "phone", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "The caller's exact phone number" }, required: true },
                                { name: "sentiment", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "A single descriptive word for the mood (e.g. Relieved, Frustrated, Good, Bad, Confused)" }, required: true },
                                { name: "category", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "Must be one of: Positive, Negative, or Neutral" }, required: true },
                                { name: "status", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "Resolved, Follow Up, Booked, or Missed" }, required: true }
                            ],
                            http: { httpMethod: "POST", baseUrlPattern: `${baseUrl}/api/tools/log_outcome` }
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
        // If it was a 400 error from Ultravox, log the body to see WHY they rejected it
        if (error.response) {
            const body = await error.response.text();
            console.error("Ultravox API Rejected Request:", body);
        }
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
        
        // Add timezone context for outbound calls too
        const nowIST_out = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const todayISO_out = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        
        finalPrompt += `\n\nCALENDAR CONTEXT: You operate strictly in IST (UTC+05:30). 
        Current detailed time is ${nowIST_out}. 
        Today's ISO date is ${todayISO_out}.
        
        STRICT RULES:
        1. ALWAYS call 'check_availability' before suggesting ANY time to a lead.
        2. DO NOT book outside of business hours or on holidays.
        3. ALWAYS use +05:30 offset. Example: 2026-04-08T15:00:00+05:30.
        4. If they ask about an existing slot, cross-reference the context provided.`;
        
        if (agentData?.personality) finalPrompt += `\n\nYour Personality/Tone: ${agentData.personality}`;
        if (reqGoal) finalPrompt += `\n\n[PRIMARY MISSION GOAL]: ${reqGoal}`;
        finalPrompt += "\n\nULTRA-IMPORTANT - EMOTIONAL EVALUATION: Monitor the lead's mood constantly. If they express strong frustration, anger, or extreme satisfaction, you MUST call 'log_call_outcome' IMMEDIATELY during the call while they are still on the line. Use a short descriptive phrase for 'sentiment' (e.g. 'Very angry and wants no more calls', 'Highly interested, wants follow up') and choose the corresponding 'category' (Positive, Negative, or Neutral).";

        const rawVoice = reqVoice || agentData?.voice_preset || "Mark";
        const validVoices = ["Alice", "Jessica", "Kelsey", "Priya", "Lulu", "Mark", "Victor", "Vitya", "Zdenek"];
        const finalVoice = validVoices.includes(rawVoice) ? rawVoice : "Mark";

        const baseUrl = `https://${req.get('host')}`;
        
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
                medium: { twilio: {} },
                selectedTools: [
                    {
                        temporaryTool: {
                            modelToolName: "check_availability",
                            description: "Check the calendar for free available time slots on a specific date (YYYY-MM-DD).",
                            dynamicParameters: [
                                {
                                    name: "target_date",
                                    location: "PARAMETER_LOCATION_BODY",
                                    schema: { type: "string", description: "The target date to check in YYYY-MM-DD format" },
                                    required: true
                                }
                            ],
                            http: { httpMethod: "POST", baseUrlPattern: `${baseUrl}/api/tools/availability` }
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
                                    schema: { type: "string", description: "ISO 8601 datetime string. e.g. 2026-04-08T15:00:00+05:30" },
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
                            http: { httpMethod: "POST", baseUrlPattern: `${baseUrl}/api/tools/book` }
                        }
                    },
                    {
                        temporaryTool: {
                            modelToolName: "log_call_outcome",
                            description: "Record the final outcome of the call including a descriptive reason and its overall emotional category.",
                            dynamicParameters: [
                                { name: "phone", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "The lead's exact phone number" }, required: true },
                                { name: "sentiment", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "A short descriptive reason (e.g. 'Disappointed with service', 'Happy to book')" }, required: true },
                                { name: "category", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "Must be one of: Positive, Negative, or Neutral" }, required: true },
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
        const { 
            system_prompt, voice_preset, temperature, 
            personality, greeting_message,
            working_days, open_time, close_time, non_working_dates 
        } = req.body;
        
        const updateData = {};
        if (system_prompt !== undefined) updateData.system_prompt = system_prompt;
        if (voice_preset !== undefined) updateData.voice_preset = voice_preset;
        if (temperature !== undefined) updateData.temperature = temperature;
        if (personality !== undefined) updateData.personality = personality;
        if (greeting_message !== undefined) updateData.greeting_message = greeting_message;
        if (working_days !== undefined) updateData.working_days = working_days;
        if (open_time !== undefined) updateData.open_time = open_time;
        if (close_time !== undefined) updateData.close_time = close_time;
        if (non_working_dates !== undefined) updateData.non_working_dates = non_working_dates;
        
        // Upsert to the first basic row
        const { data: existing } = await supabase.from('agent_settings').select('id').limit(1).single();
        
        if (existing && existing.id) {
            await supabase.from('agent_settings').update(updateData).eq('id', existing.id);
        } else {
            await supabase.from('agent_settings').insert([updateData]);
        }
        
        console.log('Agent settings saved:', Object.keys(updateData));
        res.json({ success: true, message: "Agent successfully updated globally!" });
    } catch (err) {
        console.error('Agent save error:', err);
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
                const summary = uvData.summary || "No summary available.";
                let derivedCategory = "Neutral";
                let derivedSentimentSnippet = summary.split('.')[0]; // Take first sentence as detail if missing

                // Failsafe: Keyword scan for sentiment if not already set
                const negativeWords = ["frustrat", "angr", "angry", "disappoint", "complaint", "unhappy", "bad", "terrible", "don't call", "stop calling", "no further contact", "abrupt", "hangs up", "escalated"];
                const positiveWords = ["happy", "great", "thank", "helpful", "booked", "interested", "excellent", "excited", "looking forward"];
                
                const lowerSummary = summary.toLowerCase();
                const isNegative = negativeWords.some(word => lowerSummary.includes(word));
                const isPositive = positiveWords.some(word => lowerSummary.includes(word));

                // Only apply failsafe if current category is Neutral, missing, or "Neutral" string
                const { data: currCall } = await supabase.from('calls').select('sentiment_category, sentiment').eq('twilio_sid', callSid).single();
                
                let finalCategory = currCall?.sentiment_category;
                let finalSentiment = currCall?.sentiment;

                const isNeutral = !finalCategory || finalCategory.toLowerCase() === 'neutral';

                if (isNeutral) {
                    if (isNegative) {
                        finalCategory = "Negative";
                        finalSentiment = derivedSentimentSnippet.substring(0, 80);
                    } else if (isPositive) {
                        finalCategory = "Positive";
                        finalSentiment = derivedSentimentSnippet.substring(0, 80);
                    } else {
                        finalCategory = "Neutral";
                    }
                }

                await supabase.from('calls').update({
                    status: 'completed',
                    duration_seconds: callDuration,
                    ai_summary: summary,
                    sentiment: finalSentiment || derivedSentimentSnippet.substring(0, 80),
                    sentiment_category: finalCategory,
                    transcript: "Feature pending native Ultravox messages mapping."
                }).eq('twilio_sid', callSid);
                
                console.log(`Successfully saved AI Summary and Failsafe Sentiment for Call: ${callSid}`);
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
        console.log(`[AI TOOL] Availability check for: ${target_date}`);
        
        let { data: agentData } = await supabase.from('agent_settings').select('*').limit(1).single();
        if (!agentData) {
             agentData = { working_days: ["Mon", "Tue", "Wed", "Thu", "Fri"], open_time: '09:00', close_time: '18:00', non_working_dates: [] };
        }
        
        // Determine day name (Timezone Independent Fix)
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        // Using "YYYY-MM-DD" string with getUTCDay() ensures the day is ALWAYS consistent 
        // regardless of server location.
        const targetDayName = days[new Date(target_date).getUTCDay()];
        
        // 1. Check if date is manually blocked (holiday)
        const nonWorkingDates = agentData.non_working_dates || [];
        if (nonWorkingDates.includes(target_date)) {
            return res.json({ available_slots: "Business is closed on this date (marked as holiday)." });
        }
        
        // 2. Check if day of week is a working day
        const workingDays = Array.isArray(agentData.working_days) ? agentData.working_days : ["Mon", "Tue", "Wed", "Thu", "Fri"];
        if (!workingDays.includes(targetDayName)) {
            return res.json({ available_slots: "Business is closed on " + targetDayName + "s." });
        }
        
        // 3. Generate slots in IST (30-minute intervals)
        const openTime = agentData.open_time || '09:00';
        const closeTime = agentData.close_time || '18:00';
        const [openH, openM] = openTime.split(':').map(Number);
        const [closeH, closeM] = closeTime.split(':').map(Number);
        
        const openMinutes = openH * 60 + (openM || 0);
        const closeMinutes = closeH * 60 + (closeM || 0);
        
        let allSlots = [];
        for (let m = openMinutes; m < closeMinutes; m += 30) {
            const h = Math.floor(m / 60);
            const min = m % 60;
            // Store as IST time string (no Z suffix — treated as local IST)
            const timeStr = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
            allSlots.push(`${target_date}T${timeStr}:00+05:30`);
        }
        
        // 4. Fetch existing appointments for that day to find conflicts
        const dayStart = `${target_date}T00:00:00+05:30`;
        const dayEnd = `${target_date}T23:59:59+05:30`;
        const { data: existingApps } = await supabase
            .from('appointments')
            .select('start_time')
            .gte('start_time', dayStart)
            .lte('start_time', dayEnd);
        
        // Match exact times in IST
        let bookedTimes = [];
        if (existingApps && Array.isArray(existingApps)) {
            bookedTimes = existingApps
                .filter(a => a && a.start_time)
                .map(a => {
                    const d = new Date(a.start_time);
                    if (isNaN(d.getTime())) return null;
                    // Robust IST time extraction (HH:mm)
                    return d.toLocaleString('en-GB', { 
                        timeZone: 'Asia/Kolkata', 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: false 
                    }).replace('.', ':');
                })
                .filter(t => t !== null);
        }
        
        let freeSlots = allSlots.filter(slot => {
            const slotTimePart = slot.split('T')[1].substring(0, 5); // Extract "HH:mm"
            return !bookedTimes.includes(slotTimePart);
        });
        
        console.log(`Availability for ${target_date}: ${freeSlots.length} free slots (${openTime}-${closeTime} IST)`);
        res.json({ available_slots: freeSlots.length > 0 ? freeSlots : "No free slots on this date." });
    } catch (e) {
        console.error("Availability Check Error:", e);
        res.json({ available_slots: "Error retrieving slots." });
    }
});

app.post('/api/tools/book', async (req, res) => {
    try {
        const { start_time, name, phone } = req.body;
        console.log("Book appointment received:", { start_time, name, phone });
        
        if (!start_time) {
            return res.json({ result: "Missing start_time. Ask the caller what date and time they want." });
        }
        
        const startDate = new Date(start_time);
        if (isNaN(startDate.getTime())) {
            return res.json({ result: "Invalid date format. Use ISO 8601 format like 2026-04-08T15:00:00+05:30" });
        }
        
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration
        
        const { data, error } = await supabase.from('appointments').insert([{ 
            name: name || "AI Caller", 
            phone: phone || "", 
            start_time: startDate.toISOString(), 
            end_time: endDate.toISOString(),
            status: 'confirmed',
            source: 'ai_agent'
        }]).select();
        
        if (error) {
            console.error("Supabase booking insert error:", error);
            return res.json({ result: "Failed to save appointment. Database error." });
        }
        
        console.log("Appointment booked successfully:", data?.[0]?.id);
        res.json({ result: `Appointment successfully booked for ${name || 'caller'} on ${startDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}. Confirmed!` });
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
        console.log("Delete appointment requested:", req.body);

        const { data: appointments, error } = await supabase.from('appointments').select('*').ilike('name', `%${name}%`).eq('phone', phone);
        if (error || !appointments || appointments.length === 0) {
            return res.json({ result: "Authentication failed. Name and phone do not match any existing appointment. Ask them to verify their information." });
        }

        const target = appointments[0];
        await supabase.from('appointments').delete().eq('id', target.id);
        res.json({ result: "Appointment officially cancelled and removed from the calendar." });
    } catch(err) {
        res.status(500).json({ result: "Failed to delete appointment" });
    }
});

app.post('/api/tools/log_outcome', async (req, res) => {
    try {
        const { phone, sentiment, category, status } = req.body;
        console.log("Ultravox AI triggered log_call_outcome for:", phone, sentiment, category, status);
        
        // Find the most recent active or completed call for this phone number
        const { data: calls } = await supabase
            .from('calls')
            .select('id, to_phone, from_phone')
            .or(`from_phone.eq.${phone},to_phone.eq.${phone}`)
            .order('created_at', { ascending: false })
            .limit(1);

        if (calls && calls.length > 0) {
            await supabase.from('calls').update({ 
                sentiment: sentiment, 
                sentiment_category: category, 
                call_status: status 
            }).eq('id', calls[0].id);
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

// Manual appointment booking from the Dashboard
app.post('/api/appointments/manual', async (req, res) => {
    try {
        const { name, phone, start_time } = req.body;
        if (!name || !start_time) {
            return res.status(400).json({ error: "Name and start_time are required." });
        }
        
        const startDate = new Date(start_time);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
        
        const { data, error } = await supabase.from('appointments').insert([{
            name,
            phone: phone || '',
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            status: 'confirmed',
            source: 'manual'
        }]).select();
        
        if (error) {
            console.error('Manual booking Supabase error:', error);
            return res.status(500).json({ error: error.message || "Failed to book appointment." });
        }
        console.log('Manual appointment booked:', data?.[0]?.id);
        res.json({ success: true, appointment: data[0] });
    } catch(err) {
        console.error('Manual booking error:', err);
        res.status(500).json({ error: "Failed to book appointment." });
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
        const { name, total_calls, goal, voice } = req.body;
        const { data } = await supabase.from('campaigns').insert([{ name, total_calls, goal, voice: voice || 'Mark', status: 'running', pending: total_calls || 0 }]).select();
        res.json({ success: true, campaign: data[0] });
    } catch(err) {
        res.status(500).json({ error: "API Failure" });
    }
});

// PATCH campaign stats (increment counters)
app.patch('/api/campaigns/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body; // e.g. { answered: 5, positive: 2 }
        const { data, error } = await supabase.from('campaigns').update(updates).eq('id', id).select();
        if (error) throw error;
        res.json({ success: true, campaign: data[0] });
    } catch(err) {
        res.status(500).json({ error: "API Failure" });
    }
});

// --- Shared CSV Parser (used by both CSV upload and Google Sheets) ---
function parseCSVContacts(csvText) {
    const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];
    
    let startIdx = 0;
    const firstLine = lines[0].toLowerCase();
    if (firstLine.includes('phone') || firstLine.includes('name') || firstLine.includes('number')) {
        startIdx = 1;
    }

    const contacts = [];
    for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim().replace(/"/g, ''));
        let phone = null;
        let name = null;
        for (const part of parts) {
            if (part.match(/^\+?\d[\d\s\-()]{6,}$/)) {
                phone = part.replace(/[\s\-()]/g, '');
            } else if (part.length > 1 && !phone) {
                name = part;
            }
        }
        if (phone) {
            if (!phone.startsWith('+')) {
                phone = '+' + phone;
            }
            contacts.push({ phone, name: name || 'Unknown' });
        }
    }
    return contacts;
}

async function launchCampaignWithContacts(contacts, campaignName, voice, goal, supabase) {
    const { data: campaignData, error: campErr } = await supabase.from('campaigns').insert([{
        name: campaignName,
        goal: goal || '',
        voice: voice || 'Mark',
        total_calls: contacts.length,
        pending: contacts.length,
        answered: 0,
        positive: 0,
        declined: 0,
        failed: 0,
        completed: 0,
        status: 'running'
    }]).select();

    if (campErr) throw campErr;
    const campaign = campaignData[0];

    // BACKGROUND: Sequentially dial each contact
    (async () => {
        const { data: twInt } = await supabase.from('integrations').select('*').eq('provider', 'twilio').single();
        const TWILIO_SID = twInt?.meta_data?.sid || process.env.TWILIO_ACCOUNT_SID;
        const TWILIO_AUTH = twInt?.api_key || process.env.TWILIO_AUTH_TOKEN;
        const TWILIO_PHONE = twInt?.meta_data?.phone || process.env.TWILIO_PHONE_NUMBER;

        if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_PHONE) {
            console.error("Campaign aborted: Twilio credentials missing.");
            await supabase.from('campaigns').update({ status: 'failed' }).eq('id', campaign.id);
            return;
        }

        const twilioClient = require('twilio')(TWILIO_SID, TWILIO_AUTH);
        const serverBaseUrl = "https://saas-backend.xqnsvk.easypanel.host";

        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            try {
                const webhookUrl = `${serverBaseUrl}/api/twilio/outbound-twiml?toPhone=${encodeURIComponent(contact.phone)}&voice=${encodeURIComponent(voice || '')}&goal=${encodeURIComponent(goal || '')}`;
                
                const call = await twilioClient.calls.create({
                    url: webhookUrl,
                    to: contact.phone,
                    from: TWILIO_PHONE,
                    statusCallback: `${serverBaseUrl}/api/twilio/status`,
                    statusCallbackEvent: ['completed']
                });

                await supabase.from('calls').insert([{
                    direction: 'outbound',
                    from_phone: TWILIO_PHONE,
                    to_phone: contact.phone,
                    caller_name: contact.name,
                    status: call.status,
                    twilio_sid: call.sid
                }]);

                const newPending = contacts.length - (i + 1);
                await supabase.from('campaigns').update({ 
                    pending: newPending,
                    answered: i + 1
                }).eq('id', campaign.id);

                console.log(`Campaign "${campaignName}" - Dialed ${i+1}/${contacts.length}: ${contact.phone}`);

                if (i < contacts.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 30000));
                }
            } catch (dialErr) {
                console.error(`Campaign dial failed for ${contact.phone}:`, dialErr.message);
                const { data: curr } = await supabase.from('campaigns').select('failed').eq('id', campaign.id).single();
                await supabase.from('campaigns').update({ 
                    failed: (curr?.failed || 0) + 1,
                    pending: contacts.length - (i + 1)
                }).eq('id', campaign.id);
            }
        }

        await supabase.from('campaigns').update({ status: 'completed', pending: 0 }).eq('id', campaign.id);
        console.log(`Campaign "${campaignName}" finished all ${contacts.length} calls.`);
    })();

    return campaign;
}

// CSV BULK UPLOAD + AUTO LAUNCH CAMPAIGN
app.post('/api/campaigns/csv-launch', async (req, res) => {
    try {
        const { csvText, campaignName, voice, goal } = req.body;
        console.log('CSV Launch received:', { hasCsvText: !!csvText, csvLength: csvText?.length, campaignName });
        if (!csvText || !campaignName) {
            return res.status(400).json({ error: "Missing CSV data or campaign name." });
        }

        const contacts = parseCSVContacts(csvText);

        if (contacts.length === 0) {
            return res.status(400).json({ error: "No valid phone numbers found in CSV. Make sure each row has a number with at least 7 digits." });
        }

        const campaign = await launchCampaignWithContacts(contacts, campaignName, voice, goal, supabase);

        res.json({ 
            success: true, 
            campaign, 
            message: `Campaign "${campaignName}" created with ${contacts.length} contacts. Dialing will begin shortly.` 
        });

    } catch(err) {
        console.error("CSV Campaign Launch Error:", err);
        res.status(500).json({ error: err.message || "Failed to launch campaign." });
    }
});

// GOOGLE SHEETS IMPORT + AUTO LAUNCH CAMPAIGN
app.post('/api/campaigns/gsheet-launch', async (req, res) => {
    try {
        const { sheetUrl, campaignName, voice, goal } = req.body;
        if (!sheetUrl || !campaignName) {
            return res.status(400).json({ error: "Missing Google Sheet URL or campaign name." });
        }

        const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (!match) {
            return res.status(400).json({ error: "Invalid Google Sheets URL. Make sure you copied the full link." });
        }
        const sheetId = match[1];

        console.log('Fetching Google Sheet:', sheetId);
        const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
        const csvResponse = await fetch(csvUrl);

        if (!csvResponse.ok) {
            return res.status(400).json({ error: "Could not fetch Google Sheet. Make sure sharing is set to 'Anyone with the link can view'." });
        }

        const csvText = await csvResponse.text();
        console.log('Google Sheet CSV length:', csvText.length);

        // Parse contacts directly (no internal HTTP call)
        const contacts = parseCSVContacts(csvText);
        if (contacts.length === 0) {
            return res.status(400).json({ error: "No valid phone numbers found in the Google Sheet." });
        }

        const campaign = await launchCampaignWithContacts(contacts, campaignName, voice, goal, supabase);

        res.json({ 
            success: true, 
            campaign, 
            message: `Campaign "${campaignName}" created with ${contacts.length} contacts from Google Sheet. Dialing will begin shortly.` 
        });

    } catch(err) {
        console.error("Google Sheet Import Error:", err);
        res.status(500).json({ error: err.message || "Failed to import Google Sheet." });
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
                const cat = (c.sentiment_category || '').toLowerCase();
                if (cat === 'positive') positive++;
                else if (cat === 'negative') negative++;
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
