const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');
const { Resend } = require('resend');
const cron = require('node-cron');

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

// --- OMNICHANNEL NOTIFICATIONS ENGINE ---
async function dispatchOmnichannel(appointmentId, name, phone, email, templateType, dynamicData) {
    console.log(`[Omnichannel] Dispatching ${templateType} for ${name}`);

    // Fetch keys securely from database integrations
    const { data: twInt } = await supabase.from('integrations').select('*').eq('provider', 'twilio').single();
    const TWILIO_SID = twInt?.meta_data?.sid || process.env.TWILIO_ACCOUNT_SID;
    const TWILIO_AUTH = twInt?.api_key || process.env.TWILIO_AUTH_TOKEN;
    const TWILIO_PHONE = twInt?.meta_data?.phone || process.env.TWILIO_PHONE_NUMBER;
    // WhatsApp Sandbox default
    const TWILIO_WHATSAPP_SENDER = 'whatsapp:+14155238886'; 
    
    // Fetch Resend Integration (or ENV)
    const { data: reInt } = await supabase.from('integrations').select('*').eq('provider', 'resend').single();
    const RESEND_API_KEY = reInt?.api_key || process.env.RESEND_API_KEY;

    let smsBody = "";
    let emailSubject = "";
    let emailHtml = "";
    
    const startTimeStr = dynamicData?.start_time ? new Date(dynamicData.start_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "your scheduled time";

    if (templateType === 'booking_confirmed') {
        smsBody = `Hi ${name}, your Azlon AI appointment is confirmed for ${startTimeStr}. See you soon!`;
        emailSubject = `Your appointment is confirmed, ${name}!`;
        emailHtml = `<h2>Booking Confirmed</h2><p>Hi ${name},</p><p>We have successfully scheduled your appointment for <b>${startTimeStr}</b>.</p><p>We look forward to speaking with you.</p>`;
    } else if (templateType === 'meeting_reminder') {
        smsBody = `Reminder: Hi ${name}, your meeting starts in 30 minutes at ${startTimeStr}.`;
        emailSubject = `Reminder: Upcoming Meeting in 30 Minutes`;
        emailHtml = `<h2>Meeting Reminder</h2><p>Hi ${name},</p><p>This is a quick reminder that your appointment is scheduled to start in 30 minutes at <b>${startTimeStr}</b>.</p>`;
    } else if (templateType === 'meeting_missed') {
        smsBody = `Hi ${name}, we missed you at your meeting today. Let us know when you're free to reschedule!`;
        emailSubject = `Sorry we missed you, ${name}`;
        emailHtml = `<h2>We missed you!</h2><p>Hi ${name},</p><p>We didn't see you at your appointment today at ${startTimeStr}.</p><p>Please let us know when you would like to reschedule!</p>`;
    }

    if (phone && TWILIO_SID && TWILIO_AUTH && TWILIO_PHONE) {
        try {
            const twilioClient = require('twilio')(TWILIO_SID, TWILIO_AUTH);
            let nums = String(phone).replace(/\D/g, '');
            const cleanPhone = String(phone).startsWith('+') ? String(phone) : (nums.length === 10 ? `+91${nums}` : `+${nums}`);
            // Send SMS
            await twilioClient.messages.create({ body: smsBody, from: TWILIO_PHONE, to: cleanPhone });
            console.log(`[Omnichannel] SMS sent to ${cleanPhone}`);
            // Send WhatsApp Sandbox Message
            await twilioClient.messages.create({ body: smsBody, from: TWILIO_WHATSAPP_SENDER, to: `whatsapp:${cleanPhone}` });
            console.log(`[Omnichannel] WhatsApp sent to whatsapp:${cleanPhone}`);
        } catch(e) {
            console.error(`[Omnichannel] Twilio Error:`, e.message);
        }
    }

    if (email && RESEND_API_KEY) {
        try {
            const resend = new Resend(RESEND_API_KEY);
            await resend.emails.send({
                from: 'Azlon AI <onboarding@resend.dev>',
                to: [email],
                subject: emailSubject,
                html: emailHtml
            });
            console.log(`[Omnichannel] Email sent to ${email}`);
        } catch(e) {
            console.error(`[Omnichannel] Resend Error:`, e.message);
        }
    }
}
// --- END OMNICHANNEL ENGINE ---

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
        const fallbackPrompt = "You are the smart AI receptionist for Azlon AI. Keep answers extremely short, professional, and confident. Focus on booking appointments and answering questions using the Knowledge Base. Avoid repeating your introduction unless specifically asked.";
        
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
        1. ALWAYS call 'check_availability' before suggesting ANY time to a caller.
        2. DO NOT book appointments outside of business hours or on holidays.
        3. When booking, ALWAYS use the +05:30 offset in ISO format.
        4. DATA COLLECTION: Organically collect Name, Phone, and Email BEFORE booking.
        5. EMAIL HANDLING - CRITICAL: When a caller gives you an email address by voice, pass it EXACTLY as you heard it into the 'email' parameter. DO NOT validate, reformat, or spell-check it. The backend system will automatically fix it.
           - If caller says 'contact dot simplicium at gmail dot com', pass exactly: 'contact dot simplicium at gmail dot com'
           - If the tool returns a booking error about email, DO NOT ask the caller again. Instead just retry the booking with the same email they already gave.
           - NEVER say phrases like 'could you spell that out', 'is that correct?', or 'can you confirm your email'. Just use what you heard.
        6. BOOKING RETRY: If a booking attempt fails, retry ONCE automatically with the same data before giving up.`;
        
        finalPrompt += "\n\nULTRA-IMPORTANT - CALL TERMINATION: As soon as you say a FINAL goodbye at the end of a session (e.g., 'Have a great day!' or 'Goodbye') or the caller says goodbye, you MUST call 'hang_up' IMMEDIATELY. Never wait for the caller to hang up first. This is critical to reduce telephony costs.";

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
                                    required: true
                                },
                                {
                                    name: "email",
                                    location: "PARAMETER_LOCATION_BODY",
                                    schema: { type: "string", description: "Email address exactly as spoken by the caller. Pass raw spoken text like 'contact dot name at gmail dot com' - the system will auto-convert it. Do NOT reformat or validate yourself." },
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
                            description: "Record the final outcome of the call including a descriptive sentiment word and its overall category. IMPORTANT: If the caller says they are 'not interested', this is a NEGATIVE sentiment.",
                            dynamicParameters: [
                                { name: "phone", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "The caller's exact phone number" }, required: true },
                                { name: "sentiment", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "A short 2-4 word phrase describing the mood (e.g. Very Relieved, Extremely Frustrated, Calm and Professional)" }, required: true },
                                { name: "category", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "Must be one of: Positive, Negative, or Neutral" }, required: true },
                                { name: "status", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "Resolved, Follow Up, Booked, or Missed" }, required: true }
                            ],
                            http: { httpMethod: "POST", baseUrlPattern: `${baseUrl}/api/tools/log_outcome` }
                        }
                    },
                    {
                        temporaryTool: {
                            modelToolName: "hang_up",
                            description: "Explicitly terminate the phone call and end the session. Call this as your VERY LAST action when the user says goodbye or is definitely leaving.",
                            dynamicParameters: [
                                { name: "phone", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "The caller's phone number" }, required: true }
                            ],
                            http: { httpMethod: "POST", baseUrlPattern: `${baseUrl}/api/tools/hang_up` }
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
        const { toPhone, systemPrompt, voice, goal, name } = req.body;
        if (!toPhone) return res.status(400).json({ error: "Missing toPhone parameter." });
        
        console.log(`Initiating Outbound Call to: ${toPhone}`);

        // 1. Check Twilio Credentials
        const { data: twInt } = await supabase.from('integrations').select('*').eq('provider', 'twilio').single();
        const TWILIO_SID = (twInt?.meta_data?.sid || process.env.TWILIO_ACCOUNT_SID)?.trim();
        const TWILIO_AUTH = (twInt?.api_key || process.env.TWILIO_AUTH_TOKEN)?.trim();
        const TWILIO_PHONE = (twInt?.meta_data?.phone || process.env.TWILIO_PHONE_NUMBER)?.trim();

        if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_PHONE) {
            return res.status(400).json({ error: "Twilio credentials missing. Set them in the Dashboard." });
        }

        const twilioClient = twilio(TWILIO_SID, TWILIO_AUTH);
        
        // Use exact domain to prevent .env overrides from breaking Status Callback
        const serverBaseUrl = "https://saas-backend.xqnsvk.easypanel.host";
        const webhookUrl = `${serverBaseUrl}/api/twilio/outbound-twiml?toPhone=${encodeURIComponent(toPhone || '')}&voice=${encodeURIComponent(voice || '')}&goal=${encodeURIComponent(goal || '')}&name=${encodeURIComponent(name || '')}`;

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
        // Handle Twilio Trial/Restriction errors gracefully
        let userMessage = error.message || "Failed to launch outbound API.";
        
        if (userMessage.includes("Authenticate")) {
            userMessage = "Twilio Authentication Failed! Invalid Account SID or Auth Token in Integration Settings.";
        } else if (userMessage.toLowerCase().includes("not allowed") || userMessage.toLowerCase().includes("restricted")) {
            userMessage = "Twilio Restriction: This number is not verified or allowed on your trial account.";
        }
        
        res.status(400).json({ success: false, error: userMessage });
    }
});

// Twilio Webhook (Hit exactly when the user presses the key on a trial account, or instantly on full accounts)
app.post('/api/twilio/outbound-twiml', async (req, res) => {
    try {
        const toPhone = req.query.toPhone;
        const reqVoice = req.query.voice;
        const reqGoal = req.query.goal;
        const reqName = req.query.name;

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
        
        if (reqName) {
            finalPrompt += `\n\n[CRITICAL OUTBOUND CONTEXT]: You are initiating an outbound call to a designated lead. The lead's name is ${reqName} and their phone number is ${toPhone}. 
            - IMPORTANT: You already know their name and phone number. DO NOT ask them for their name or their phone number. 
            - IMPORTANT: Greet them naturally by their first name as soon as they answer (e.g., "Hi ${reqName}, how are you?").`;
        }

        finalPrompt += "\n\nULTRA-IMPORTANT - CALL TERMINATION: As soon as you say a FINAL goodbye or the lead says goodbye, you MUST call 'hang_up' IMMEDIATELY. Never wait for them to hang up. This is critical to reduce telephony costs.";

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
                            description: reqName ? `Book an appointment for ${reqName} on the calendar. Use context variables directly, do NOT ask the user for name or phone.` : "Book an appointment for the caller on the calendar.",
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
                                    schema: { type: "string", description: reqName ? `Must be exactly: ${reqName}` : "Full name of caller" },
                                    required: reqName ? false : true // Required if no context, false if context exists
                                },
                                {
                                    name: "phone",
                                    location: "PARAMETER_LOCATION_BODY",
                                    schema: { type: "string", description: reqName ? `Must be exactly: ${toPhone}` : "Contact number" },
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
                    },
                    {
                        temporaryTool: {
                            modelToolName: "hang_up",
                            description: "Explicitly terminate the phone call to end the session. Call this as your VERY LAST action when the user says goodbye or is definitely leaving.",
                            dynamicParameters: [
                                { name: "phone", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "The lead's phone number" }, required: true }
                            ],
                            http: { httpMethod: "POST", baseUrlPattern: `${baseUrl}/api/tools/hang_up` }
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
            .order('created_at', { ascending: false });
            
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

                // ── Keyword-based failsafe sentiment scanner ──────────────────
                const negativeWords = ["frustrat", "angr", "angry", "disappoint", "complaint", "unhappy", "bad", "terrible", "don't call", "stop calling", "no further contact", "abrupt", "hangs up", "escalated", "rude", "useless", "waste", "not interested", "failed to book", "fail to book"];
                const positiveWords = ["happy", "great", "thank", "helpful", "interested", "excellent", "excited", "looking forward", "confirmed", "resolved", "satisfied", "pleased", "appreciate", "good experience"];

                const lowerSummary = summary.toLowerCase();
                
                // Smart check for NOT booked vs Booked
                const isExplicitlyNotBooked = lowerSummary.includes("not book") || lowerSummary.includes("didn't book") || lowerSummary.includes("did not book") || lowerSummary.includes("no appointment") || lowerSummary.includes("unsuccessful") || lowerSummary.includes("decline");
                const isExplicitlyBooked = !isExplicitlyNotBooked && (lowerSummary.includes("booked") || lowerSummary.includes("confirmed appointment"));

                let isNegative = negativeWords.some(word => lowerSummary.includes(word)) || isExplicitlyNotBooked;
                let isPositive = positiveWords.some(word => lowerSummary.includes(word)) || isExplicitlyBooked;

                // Map a short 1-2 word reason from keywords
                let mappedReason = null;
                if (isExplicitlyNotBooked) mappedReason = "Not Booked";
                else if (isExplicitlyBooked) mappedReason = "Booked";
                else if (lowerSummary.includes("frustrat")) mappedReason = "Frustrated";
                else if (lowerSummary.includes("angr")) mappedReason = "Angry";
                else if (lowerSummary.includes("disappoint")) mappedReason = "Disappointed";
                else if (lowerSummary.includes("escalat")) mappedReason = "Escalated";
                else if (lowerSummary.includes("interest")) mappedReason = "Interested";
                else if (lowerSummary.includes("thank")) mappedReason = "Thankful";
                else if (lowerSummary.includes("satisf") || lowerSummary.includes("pleased")) mappedReason = "Satisfied";
                else if (lowerSummary.includes("resolv")) mappedReason = "Resolved";
                else if (isPositive) mappedReason = "Positive";
                else if (isNegative) mappedReason = "Negative";

                // ── Check if AI already logged a real sentiment via log_call_outcome ──
                const { data: currCall } = await supabase.from('calls').select('sentiment_category, sentiment').eq('twilio_sid', callSid).single();

                const aiAlreadyLogged = currCall?.sentiment_category && currCall.sentiment_category !== 'Neutral' && currCall.sentiment_category !== null;

                let finalCategory = currCall?.sentiment_category || 'Neutral';
                let finalSentiment = currCall?.sentiment || 'Neutral';

                if (aiAlreadyLogged) {
                    // ✅ AI logged a real sentiment in real-time — trust it, don't override
                    console.log(`[SENTIMENT] AI already logged: ${finalCategory} (${finalSentiment}) for ${callSid} — keeping AI result.`);
                } else {
                    // Fallback: use keyword scan on the summary
                    if (isNegative && !isPositive) {
                        finalCategory = 'Negative';
                        finalSentiment = mappedReason || 'Negative';
                        console.log(`[SENTIMENT] Keyword fallback → NEGATIVE for ${callSid}.`);
                    } else if (isPositive && !isNegative) {
                        finalCategory = 'Positive';
                        finalSentiment = mappedReason || 'Positive';
                        console.log(`[SENTIMENT] Keyword fallback → POSITIVE for ${callSid}.`);
                    } else {
                        // If conflict or none, default to neutral but keep reasoned tag
                        finalCategory = 'Neutral';
                        finalSentiment = mappedReason || 'Neutral';
                        console.log(`[SENTIMENT] No strong/conflicting signal found — staying Neutral for ${callSid}.`);
                    }
                }

                await supabase.from('calls').update({
                    status: 'completed',
                    duration_seconds: callDuration,
                    ai_summary: summary,
                    sentiment: finalSentiment,
                    sentiment_category: finalCategory,
                    transcript: "Feature pending native Ultravox messages mapping."
                }).eq('twilio_sid', callSid);

                console.log(`[SENTIMENT_SYSTEM_v3.0] Final for ${callSid}: ${finalCategory} (${finalSentiment})`);
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
        // Extract simple YYYY-MM-DD from target_date to match nonWorkingDates precisely
        const cleanTargetDate = target_date.split('T')[0];
        
        if (nonWorkingDates.includes(cleanTargetDate)) {
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

// Helper: extract email from any property in a body object (catches nested/aliased keys)
function extractEmailFromBody(body) {
    const emailKeys = ['email', 'email_address', 'user_email', 'emailAddress', 'callerEmail', 'contact_email'];
    for (const key of emailKeys) {
        if (body[key] && typeof body[key] === 'string' && body[key].trim() !== '') {
            return body[key].trim();
        }
    }
    // Last resort: scan all string values for something that looks email-like
    for (const val of Object.values(body)) {
        if (typeof val === 'string' && (val.includes('@') || val.includes(' at ') || val.includes('gmail') || val.includes('.com'))) {
            return val.trim();
        }
    }
    return null;
}

// Helper: aggressively repair STT-transcribed email text
function repairEmail(raw) {
    if (!raw) return null;
    let e = String(raw).toLowerCase().trim();
    // Replace spoken words with symbols (most specific patterns first)
    e = e.replace(/\bat\s+the\s+rate\s+of\b/g, '@');
    e = e.replace(/\bat\s+the\s+rate\b/g, '@');
    e = e.replace(/\bthe\s+at\s+sign\b/g, '@');
    e = e.replace(/\bat\s+symbol\b/g, '@');
    e = e.replace(/\s*@\s*/g, '@');  // remove spaces around @
    e = e.replace(/\bunder\s+score\b/g, '_');
    e = e.replace(/\bunderscore\b/g, '_');
    e = e.replace(/\bdash\b/g, '-');
    e = e.replace(/\bhyphen\b/g, '-');
    e = e.replace(/\bperiod\b/g, '.');
    e = e.replace(/\bpoint\b/g, '.');
    e = e.replace(/\bdot\b/g, '.');
    e = e.replace(/\bat\b/g, '@');  // standalone 'at'
    // Remove all remaining whitespace
    e = e.replace(/\s+/g, '');
    return e;
}

app.post('/api/tools/book', async (req, res) => {
    try {
        let { start_time, name, phone } = req.body;
        // HYPER-RESILIENT: extract email from any possible parameter name/location
        let rawEmail = extractEmailFromBody(req.body);
        let email = repairEmail(rawEmail);

        console.log("[BOOK] Received:", { start_time, name, phone, rawEmail, repairedEmail: email });
        
        // --- AI VALIDATION GUARDRAILS (softened messages to stop loops) ---
        if (!name || name.trim() === '' || name.toLowerCase().includes('unknown')) {
            return res.json({ result: "I still need the caller's full name to complete the booking. Could you please collect it?" });
        }
        if (!phone || phone.trim() === '' || phone.toLowerCase().includes('unknown')) {
            return res.json({ result: "I still need the caller's phone number to complete the booking. Could you please collect it?" });
        }

        // Email is optional — we try to book even without it, but log if missing
        if (!email || !email.includes('@')) {
            console.warn(`[BOOK] Email missing or invalid after repair. raw='${rawEmail}' repaired='${email}'. Proceeding without email.`);
            email = null; // Allow booking without email rather than failing
        }

        if (!start_time) {
            return res.json({ result: "Missing start_time. Ask the caller what date and time they want." });
        }
        
        const startDate = new Date(start_time);
        if (isNaN(startDate.getTime())) {
            return res.json({ result: "Invalid date format. Use ISO 8601 format like 2026-04-08T15:00:00+05:30" });
        }

        // --- HOLIDAY & WORKING DAY GUARDRAIL ---
        let { data: agentData } = await supabase.from('agent_settings').select('non_working_dates, working_days').limit(1).single();
        const dateStr = startDate.toISOString().split('T')[0];
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const targetDayName = days[startDate.getUTCDay()];

        if (agentData) {
            if ((agentData.non_working_dates || []).includes(dateStr)) {
                return res.json({ result: "I apologize, but we are closed on this date for a holiday. Please suggest another day." });
            }
            const workingDays = Array.isArray(agentData.working_days) ? agentData.working_days : ["Mon", "Tue", "Wed", "Thu", "Fri"];
            if (!workingDays.includes(targetDayName)) {
                return res.json({ result: `I'm sorry, we are not open on ${targetDayName}s. Would you like to try another day?` });
            }
        }
        
        // --- DATA INTEGRITY FIX: Double-check availability before booking ---
        const { data: existing } = await supabase.from('appointments').select('id').eq('start_time', startDate.toISOString()).eq('status', 'confirmed').single();
        if (existing) {
            console.warn(`[AI TOOL] ❌ Double-book prevented for: ${start_time}`);
            return res.json({ result: "I am so sorry, but that exact slot was just taken by another caller while we were speaking. Please check for the next available slot or suggest a different time." });
        }

        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration
        
        const bookingPayload = { 
            name: name || "AI Caller", 
            phone: phone || "", 
            email: email || null,
            notes: req.body.notes || null,
            start_time: startDate.toISOString(), 
            end_time: endDate.toISOString(),
            status: 'confirmed',
            source: 'ai_agent'
        };

        const { data, error } = await supabase.from('appointments').insert([bookingPayload]).select();
        
        if (error) {
            console.error("Supabase booking insert error:", error);
            return res.json({ result: "Failed to save appointment. Database error." });
        }

        // --- STATUS SYNC FIX: Ensure call status is 'Booked' instantly ---
        if (phone) {
            const cleanPhone = String(phone).replace(/\D/g, '');
            // Search for the most recent call with a fuzzy match for the phone number
            const { data: recentCall } = await supabase.from('calls').select('id').or(`from_phone.ilike.%${cleanPhone}%,to_phone.ilike.%${cleanPhone}%`).order('created_at', { ascending: false }).limit(1).single();
            if (recentCall) {
                await supabase.from('calls').update({ call_status: 'Booked', sentiment: 'Booked' }).eq('id', recentCall.id);
            }
        }
        
        console.log("Appointment booked successfully:", data?.[0]?.id, bookingPayload);
        
        let leadEmail = email || null;
        if (phone) {
            const cleanPhone = String(phone).replace(/\D/g, '');
            const { data: existingLead } = await supabase.from('leads').select('id, email').eq('phone', phone).single();
            if (existingLead) {
                leadEmail = leadEmail || existingLead.email;
                const updatePayload = { segment: 'Qualified', ai_context: `Booked appointment on ${startDate.toLocaleDateString()}` };
                if (email) updatePayload.email = email;
                await supabase.from('leads').update(updatePayload).eq('id', existingLead.id);
            } else {
                await supabase.from('leads').insert([{ name: name || 'New Lead', phone: phone, email: leadEmail, segment: 'Qualified', source: 'AI Booking', ai_context: 'Auto-qualified via appointment booking.' }]);
            }
        }

        // TRIGGER CONFIRMATION ALONG WITH BOOKING
        await dispatchOmnichannel((data?.[0]?.id || 'unknown'), name || 'caller', phone, leadEmail, 'booking_confirmed', { start_time: startDate.toISOString() });

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
        const cleanPhone = String(phone).replace(/\D/g, '');
        console.log(`[log_outcome] AI logged phone=${phone} | sentiment='${sentiment}' | category='${category}' | status='${status}'`);

        const validCategories = ['Positive', 'Negative', 'Neutral'];
        const safeCategory = validCategories.includes(category) ? category : 'Neutral';

        const { data: calls } = await supabase
            .from('calls')
            .select('id, duration_seconds')
            .or(`from_phone.ilike.%${cleanPhone}%,to_phone.ilike.%${cleanPhone}%`)
            .order('created_at', { ascending: false })
            .limit(1);

        if (calls && calls.length > 0) {
            const call = calls[0];
            let finalStatus = status;
            let finalSentimentStr = sentiment;
            let finalCat = safeCategory;

            // 1. Status Override: If duration > 0, it CANNOT be MISSED
            if (Number(call.duration_seconds || 0) > 0 && (status === 'Missed' || status === 'Missed Call')) {
                finalStatus = 'Completed';
            }

            // 2. Appointment Sanity Check: If AI says 'Booked', verify it really exists
            if (sentiment && sentiment.toLowerCase().includes('book')) {
                const { data: appt } = await supabase.from('appointments').select('id').eq('phone', phone).eq('status', 'confirmed').limit(1);
                if (!appt || appt.length === 0) {
                    finalSentimentStr = 'Interested (No Booking Found)';
                    finalCat = 'Neutral';
                    console.log(`[log_outcome] Correction: AI claimed "Booked" but no appt found for ${phone}. Overriding.`);
                }
            }

            const updatePayload = {
                sentiment: finalSentimentStr,
                sentiment_category: finalCat,
            };
            if (finalStatus) updatePayload.call_status = finalStatus;
            await supabase.from('calls').update(updatePayload).eq('id', call.id);

            // --- LEAD CRM SYNC: Automatic Capture ---
            const { data: existingLead } = await supabase.from('leads').select('id').eq('phone', phone).single();
            const leadSegment = sentiment?.toLowerCase().includes('book') ? 'Qualified' : (safeCategory === 'Positive' ? 'Hot' : 'Warm');
            
            if (existingLead) {
                await supabase.from('leads').update({ 
                    segment: leadSegment, 
                    ai_context: `Last Call Outcome: ${finalSentimentStr}. Mood: ${finalCat}`,
                }).eq('id', existingLead.id);
            } else {
                await supabase.from('leads').insert([{
                    name: 'New AI Lead',
                    phone: phone,
                    segment: leadSegment,
                    ai_context: `AI captured outcome: ${finalSentimentStr}`,
                    source: 'AI Voice'
                }]);
            }
        }
        res.json({ result: "Outcome logged successfully." });
    } catch(err) {
        res.status(500).json({ result: "Failed to log outcome" });
    }
});

app.post('/api/tools/hang_up', async (req, res) => {
    try {
        const { phone } = req.body;
        console.log(`[HANGUP] AI triggered termination for phone=${phone}`);
        const cleanPhone = String(phone).replace(/\D/g, '');

        const { data: calls } = await supabase
            .from('calls')
            .select('id, twilio_sid')
            .or(`from_phone.ilike.%${cleanPhone}%,to_phone.ilike.%${cleanPhone}%`)
            .order('created_at', { ascending: false })
            .limit(1);

        if (calls && calls.length > 0 && calls[0].twilio_sid) {
            const { data: twInt } = await supabase.from('integrations').select('*').eq('provider', 'twilio').single();
            const TWILIO_SID = twInt?.meta_data?.sid || process.env.TWILIO_ACCOUNT_SID;
            const TWILIO_AUTH = twInt?.api_key || process.env.TWILIO_AUTH_TOKEN;

            if (TWILIO_SID && TWILIO_AUTH) {
                const twilioClient = require('twilio')(TWILIO_SID, TWILIO_AUTH);
                await twilioClient.calls(calls[0].twilio_sid).update({ status: 'completed' });
                console.log(`[HANGUP] 📞 Disconnected Twilio Call: ${calls[0].twilio_sid}`);
            }
        }
        res.json({ result: "Call successfully terminated. Have a good day!" });
    } catch(err) {
        console.error("Hangup Error:", err);
        res.status(500).json({ result: "Failed to hang up" });
    }
});

app.post('/api/fix-sentiment', async (req, res) => {
    try {
        console.log("[SENTIMENT_FIX_v3.0] Running bidirectional mass correction on Neutral calls...");
        const { data: calls } = await supabase.from('calls').select('*').eq('sentiment_category', 'Neutral');

        const negativeWords = ["frustrat", "angr", "angry", "disappoint", "complaint", "unhappy", "bad", "terrible", "rude", "escalat", "hang up", "useless", "waste", "not interested", "neither interested", "no thanks", "don't want", "not now", "busy"];
        const positiveWords = ["happy", "great", "thank", "helpful", "booked", "interested", "excellent", "excited", "confirmed", "resolved", "satisfied", "pleased", "appreciate"];

        let fixedCount = 0;

        for (const call of (calls || [])) {
            const summary = (call.ai_summary || "").toLowerCase();

            const isNegative = negativeWords.some(word => summary.includes(word));
            const isPositive = positiveWords.some(word => summary.includes(word));

            let newCategory = null;
            let newReason = null;

            if (isNegative) {
                newCategory = 'Negative';
                if (summary.includes("not interested") || summary.includes("neither interested") || summary.includes("no thanks")) newReason = "Not Interested";
                else if (summary.includes("frustrat")) newReason = "Frustrated";
                else if (summary.includes("angr")) newReason = "Angry";
                else if (summary.includes("disappoint")) newReason = "Disappointed";
                else if (summary.includes("escalat")) newReason = "Escalated";
                else newReason = "Negative";
            } else if (isPositive) {
                newCategory = 'Positive';
                if (summary.includes("booked") || summary.includes("confirmed")) newReason = "Booked";
                else if (summary.includes("interest")) newReason = "Interested";
                else if (summary.includes("thank")) newReason = "Thankful";
                else if (summary.includes("satisf") || summary.includes("pleased")) newReason = "Satisfied";
                else if (summary.includes("resolv")) newReason = "Resolved";
                else newReason = "Positive";
            }

            if (newCategory) {
                await supabase.from('calls').update({
                    sentiment_category: newCategory,
                    sentiment: newReason
                }).eq('id', call.id);
                fixedCount++;
            }
        }

        console.log(`[SENTIMENT_FIX_v3.0] Fixed ${fixedCount} calls.`);
        res.json({ success: true, fixed: fixedCount });
    } catch(err) {
        console.error("Mass Correction Failed:", err);
        res.status(500).json({ error: "Correction failed" });
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

// --- DASHBOARD APPOINTMENT MANAGEMENT ---
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
        
        // TRIGGER CONFIRMATION
        let leadEmail = null;
        if (phone) {
            const { data: existingLead } = await supabase.from('leads').select('email').eq('phone', phone).single();
            if (existingLead) leadEmail = existingLead.email;
        }
        await dispatchOmnichannel(data[0].id, name, phone, leadEmail, 'booking_confirmed', { start_time: startDate.toISOString() });

        res.json({ success: true, appointment: data[0] });
    } catch(err) {
        console.error('Manual booking error:', err);
        res.status(500).json({ error: "Failed to book appointment." });
    }
});

app.put('/api/appointments/manual/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { action, start_time, status } = req.body;

        if (action === 'reschedule' && start_time) {
            const startDate = new Date(start_time);
            const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
            const { data, error } = await supabase.from('appointments').update({
                start_time: startDate.toISOString(),
                end_time: endDate.toISOString()
            }).eq('id', id).select();

            if (error) throw error;
            return res.json({ success: true, appointment: data[0] });
        } 
        
        if (action === 'complete' || status === 'completed') {
            const { data, error } = await supabase.from('appointments').update({
                status: 'completed'
            }).eq('id', id).select();

            if (error) throw error;
            return res.json({ success: true, appointment: data[0] });
        }

        res.status(400).json({ error: "Invalid action or parameters." });
    } catch(err) {
        console.error('Manual update error:', err);
        res.status(500).json({ error: "Failed to update appointment." });
    }
});

app.delete('/api/appointments/manual/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('appointments').delete().eq('id', id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch(err) {
        console.error('Manual delete error:', err);
        res.status(500).json({ error: "Failed to delete appointment." });
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

// --- INTEGRATIONS (TWILIO / API KEYS) ---
app.get('/api/integrations/twilio', async (req, res) => {
    try {
        const { data, error } = await supabase.from('integrations').select('*').eq('provider', 'twilio').single();
        if (error && error.code !== 'PGRST116') throw error;
        if (!data) return res.json({ success: true, integration: null });
        const masked = {
            sid: data.meta_data?.sid || '',
            phone: data.meta_data?.phone || '',
            api_key: data.api_key ? (data.api_key.substring(0, 4) + '****************' + data.api_key.substring(data.api_key.length - 4)) : ''
        };
        res.json({ success: true, integration: masked });
    } catch(err) { res.status(500).json({ error: "Failed to fetch integration" }); }
});

app.post('/api/integrations/twilio', async (req, res) => {
    try {
        const { sid, api_key, phone } = req.body;
        const { data: existing } = await supabase.from('integrations').select('*').eq('provider', 'twilio').single();
        
        let finalApiKey = api_key?.trim();
        // If the user submitted the masked placeholder, keep their existing secret!
        if (finalApiKey && finalApiKey.includes('****')) {
            finalApiKey = existing?.api_key || finalApiKey;
        }

        const payload = { 
            provider: 'twilio', 
            api_key: finalApiKey, 
            meta_data: { sid: sid?.trim(), phone: phone?.trim() }
        };
        
        let dbErr = null;
        if (existing) {
            const { error } = await supabase.from('integrations').update(payload).eq('id', existing.id);
            dbErr = error;
        } else {
            const { error } = await supabase.from('integrations').insert([payload]);
            dbErr = error;
        }
        
        if (dbErr) return res.status(500).json({ error: dbErr.message });
        
        res.json({ success: true, message: "Twilio integration updated." });
    } catch(err) { res.status(500).json({ error: "Failed to save integration: " + err.message }); }
});

// --- RESEND INTEGRATION ---
app.get('/api/integrations/resend', async (req, res) => {
    try {
        const { data, error } = await supabase.from('integrations').select('*').eq('provider', 'resend').single();
        if (error && error.code !== 'PGRST116') throw error;
        if (!data) return res.json({ success: true, integration: null });
        const masked = {
            api_key: data.api_key ? (data.api_key.substring(0, 4) + '****************' + data.api_key.substring(data.api_key.length - 4)) : ''
        };
        res.json({ success: true, integration: masked });
    } catch(err) { res.status(500).json({ error: "Failed to fetch integration" }); }
});

app.post('/api/integrations/resend', async (req, res) => {
    try {
        const { api_key } = req.body;
        if (!api_key) return res.status(400).json({ error: "Missing API Key" });

        const { data: existing } = await supabase.from('integrations').select('*').eq('provider', 'resend').single();
        
        let finalApiKey = api_key.trim();
        if (finalApiKey.includes('****')) {
            finalApiKey = existing?.api_key || finalApiKey;
        }

        const payload = { 
            provider: 'resend', 
            api_key: finalApiKey
        };
        
        const { error: revErr } = await supabase.from('integrations').upsert(payload, { onConflict: 'provider' });

        if (revErr) return res.status(500).json({ error: revErr.message });
        res.json({ success: true, message: "Resend integration updated." });
    } catch(err) { res.status(500).json({ error: "Failed to save integration" }); }
});

// --- ULTRAVOX INTEGRATION ---
app.get('/api/integrations/ultravox', async (req, res) => {
    try {
        const { data, error } = await supabase.from('integrations').select('*').eq('provider', 'ultravox').single();
        if (error && error.code !== 'PGRST116') throw error;
        if (!data) return res.json({ success: true, integration: null });
        const masked = {
            api_key: data.api_key ? (data.api_key.substring(0, 4) + '****************' + data.api_key.substring(data.api_key.length - 4)) : ''
        };
        res.json({ success: true, integration: masked });
    } catch(err) { res.status(500).json({ error: "Failed to fetch integration" }); }
});

app.post('/api/integrations/ultravox', async (req, res) => {
    try {
        const { api_key } = req.body;
        if (!api_key) return res.status(400).json({ error: "Missing API Key" });

        const { data: existing } = await supabase.from('integrations').select('*').eq('provider', 'ultravox').single();
        
        let finalApiKey = api_key.trim();
        if (finalApiKey.includes('****')) {
            finalApiKey = existing?.api_key || finalApiKey;
        }

        const payload = { 
            provider: 'ultravox', 
            api_key: finalApiKey
        };
        
        const { error: uvErr } = await supabase.from('integrations').upsert(payload, { onConflict: 'provider' });

        if (uvErr) return res.status(500).json({ error: uvErr.message });
        res.json({ success: true, message: "Ultravox integration updated." });
    } catch(err) { res.status(500).json({ error: "Failed to save integration" }); }
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
        const TWILIO_SID = (twInt?.meta_data?.sid || process.env.TWILIO_ACCOUNT_SID)?.trim();
        const TWILIO_AUTH = (twInt?.api_key || process.env.TWILIO_AUTH_TOKEN)?.trim();
        const TWILIO_PHONE = (twInt?.meta_data?.phone || process.env.TWILIO_PHONE_NUMBER)?.trim();

        if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_PHONE) {
            console.error("Campaign aborted: Twilio credentials missing.");
            await supabase.from('campaigns').update({ status: 'failed' }).eq('id', campaign.id);
            return;
        }

        let twilioClient;
        try {
            twilioClient = require('twilio')(TWILIO_SID, TWILIO_AUTH);
        } catch(err) {
            console.error("Twilio Initialization Error:", err.message);
            await supabase.from('campaigns').update({ status: 'failed' }).eq('id', campaign.id);
            return;
        }
        const serverBaseUrl = "https://saas-backend.xqnsvk.easypanel.host";

        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            try {
                const webhookUrl = `${serverBaseUrl}/api/twilio/outbound-twiml?toPhone=${encodeURIComponent(contact.phone)}&voice=${encodeURIComponent(voice || '')}&goal=${encodeURIComponent(goal || '')}&name=${encodeURIComponent(contact.name || '')}`;
                
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
        
        // Advanced aggregations for charting
        const statusCounts = { "Booked": 0, "Resolved": 0, "Follow Up": 0, "Missed": 0, "Standard Inquiry": 0 };
        const hourlyVolume = new Array(24).fill(0).map((_, i) => {
            const h = i === 0 ? 12 : (i > 12 ? i - 12 : i);
            const ampm = i < 12 ? 'AM' : 'PM';
            return { hour: `${h} ${ampm}`, count: 0, index: i };
        });
        const recentDurations = [];

        if (calls) {
            const nowUTC = new Date();
            const nowIST = new Date(nowUTC.getTime() + (5.5 * 60 * 60 * 1000));
            const todayStr = nowIST.toISOString().split('T')[0]; // Current IST date (YYYY-MM-DD)

            calls.forEach(c => {
                // 1. Sentiment stats
                const cat = (c.sentiment_category || '').toLowerCase();
                if (cat === 'positive') positive++;
                else if (cat === 'negative') negative++;
                else neutral++;

                // 2. Status/Outcome Stats
                const rawStatus = c.status || '';
                let s = rawStatus;
                if (!c.duration_seconds || Number(c.duration_seconds) === 0) {
                    s = "No Connection";
                } else {
                    // Use the specific call_status column if the AI set it (Booked, Follow Up, Resolved)
                    s = c.call_status || "Standard Inquiry";
                }
                
                if (Object.prototype.hasOwnProperty.call(statusCounts, s)) {
                    statusCounts[s]++;
                } else if (s.toLowerCase().includes('book')) {
                    statusCounts["Booked"]++;
                } else if (s.toLowerCase().includes('standard')) {
                    statusCounts["Standard Inquiry"]++;
                } else if (s === "No Connection") {
                    if (!statusCounts["No Connection"]) statusCounts["No Connection"] = 0;
                    statusCounts["No Connection"]++;
                }

                // 3. Hourly Trend (TIMEZONE FIX: Shift UTC to IST for charts)
                if (c.created_at) {
                    const utcDate = new Date(c.created_at);
                    const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
                    const callDateStr = istDate.toISOString().split('T')[0];
                    
                    // ONLY include calls from TODAY in the hourly chart to prevent cumulative peaks
                    if (callDateStr === todayStr) {
                        const hour = istDate.getUTCHours();
                        if (!isNaN(hour) && hour >= 0 && hour < 24) {
                            hourlyVolume[hour].count++;
                        }
                    }
                }

                // 4. Duration Trend (Last 20, Sorted)
                if (c.duration_seconds && c.created_at) {
                    recentDurations.push({
                        time: new Date(c.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }),
                        duration: Math.round(c.duration_seconds),
                        raw_time: new Date(c.created_at).getTime()
                    });
                }
            });

            // FALLBACK: If calls aren't tagged 'Booked' but appointments exist, override.
            if (apps && apps.length > statusCounts["Booked"]) {
                const diff = apps.length - statusCounts["Booked"];
                statusCounts["Booked"] = apps.length;
                if (statusCounts["Standard Inquiry"] >= diff) statusCounts["Standard Inquiry"] -= diff;
            }
        }

        // Sort charts chronologically
        recentDurations.sort((a, b) => a.raw_time - b.raw_time);

        res.json({ 
            success: true, 
            metrics: {
                totalCalls,
                inboundCalls: calls ? calls.filter(c => c.direction === 'inbound').length : 0,
                outboundCalls: calls ? calls.filter(c => c.direction === 'outbound').length : 0,
                totalMinutes: Math.floor(totalDuration / 60) || 0,
                sentiment: { positive, negative, neutral },
                totalLeads: leads ? leads.length : 0,
                bookedAppointments: apps ? apps.length : 0,
                // NEW: Chart Data
                outcomes: Object.entries(statusCounts).map(([name, value]) => ({ name, value })),
                hourlyVolume: hourlyVolume,
                recentDurations: recentDurations.slice(-10)
            }
        });
    } catch (err) {
        console.error("Reports API Error:", err);
        res.status(500).json({ error: "Could not generate reports." });
    }
});

// --- CRON JOBS FOR NOTIFICATIONS ---
// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
    console.log('[Cron] Checking for upcoming & missed appointments...');
    try {
        const now = new Date();
        const thirtyMinsFromNow = new Date(now.getTime() + 35 * 60 * 1000);
        const nowIso = now.toISOString();
        const thirtyMinsIso = thirtyMinsFromNow.toISOString();

        // 1. Upcoming Reminders (Starting between now and +35 mins)
        const { data: upcoming } = await supabase.from('appointments')
            .select('*')
            .eq('status', 'confirmed')
            .eq('reminder_sent', false)
            .gte('start_time', nowIso)
            .lte('start_time', thirtyMinsIso);

        if (upcoming && upcoming.length > 0) {
            for (const appt of upcoming) {
                // To fetch their email, join with leads table
                let leadEmail = appt.email;
                if (!leadEmail && appt.phone) {
                    const { data: ld } = await supabase.from('leads').select('email').eq('phone', appt.phone).single();
                    if (ld?.email) leadEmail = ld.email;
                }
                await dispatchOmnichannel(appt.id, appt.name, appt.phone, leadEmail, 'meeting_reminder', { start_time: appt.start_time });
                await supabase.from('appointments').update({ reminder_sent: true }).eq('id', appt.id);
            }
        }

        // 2. Missed Appointments (NOT 'completed' AND ended in the past)
        const { data: missed } = await supabase.from('appointments')
            .select('*')
            .eq('status', 'confirmed')
            .eq('missed_notified', false)
            .lte('end_time', nowIso); // meeting time has passed

        if (missed && missed.length > 0) {
            for (const appt of missed) {
                let leadEmail = appt.email;
                if (!leadEmail && appt.phone) {
                    const { data: ld } = await supabase.from('leads').select('email').eq('phone', appt.phone).single();
                    if (ld?.email) leadEmail = ld.email;
                }
                
                await dispatchOmnichannel(appt.id, appt.name, appt.phone, leadEmail, 'meeting_missed', { start_time: appt.start_time });
                // We auto-mark them as missed
                await supabase.from('appointments').update({ status: 'missed', missed_notified: true }).eq('id', appt.id);
            }
        }
    } catch(err) {
        console.error('[Cron Error]', err);
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Backend API running on port ${PORT}...`);
});
