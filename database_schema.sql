-- Voice AI SaaS Database Schema for Supabase

-- 1. Create the Calls Table (Call Logging & Analytics)
CREATE TABLE public.calls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    from_phone TEXT NOT NULL,
    to_phone TEXT NOT NULL,
    duration_seconds INTEGER DEFAULT 0,
    status TEXT DEFAULT 'completed',
    transcript TEXT,
    ai_summary TEXT,
    recording_url TEXT,
    twilio_sid TEXT UNIQUE
);

-- 2. Create the Agents Table (Storing System Prompts dynamically)
CREATE TABLE public.agent_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT DEFAULT 'My Assistant',
    system_prompt TEXT NOT NULL,
    voice_preset TEXT DEFAULT 'Mark',
    language TEXT DEFAULT 'en-US',
    temperature FLOAT DEFAULT 0.3
);

-- 3. Create the CRM Contacts Table (For Outbound Leads)
CREATE TABLE public.contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT NOT NULL,
    phone_number TEXT UNIQUE NOT NULL,
    email TEXT,
    notes TEXT,
    last_called_at TIMESTAMP WITH TIME ZONE
);

-- Note: In a true SaaS, you would add a `user_id UUID REFERENCES auth.users(id)` 
-- to each of these tables so different customers only see their own data! 
-- For now, this is the foundational core!
