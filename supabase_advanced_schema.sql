-- AZLON AI - ADVANCED SAAS SCHEMA UPGRADE (V2)
-- WARNING: Run this in your Supabase SQL Editor to apply the new features!

-- 1. Modify Existing 'calls' table
ALTER TABLE public.calls
ADD COLUMN IF NOT EXISTS sentiment TEXT DEFAULT 'Neutral',
ADD COLUMN IF NOT EXISTS call_status TEXT DEFAULT 'Completed',
ADD COLUMN IF NOT EXISTS recording_url TEXT,
ADD COLUMN IF NOT EXISTS caller_name TEXT,
ADD COLUMN IF NOT EXISTS duration TEXT;

-- 2. Modify Existing 'agent_settings' table
ALTER TABLE public.agent_settings
ADD COLUMN IF NOT EXISTS greeting_message TEXT DEFAULT 'Hello, this is your AI agent. How can I help you today?',
ADD COLUMN IF NOT EXISTS personality TEXT DEFAULT 'professional',
ADD COLUMN IF NOT EXISTS working_days JSONB DEFAULT '["Mon", "Tue", "Wed", "Thu", "Fri"]'::jsonb,
ADD COLUMN IF NOT EXISTS open_time TEXT DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS close_time TEXT DEFAULT '18:00',
ADD COLUMN IF NOT EXISTS non_working_dates JSONB DEFAULT '[]'::jsonb;

-- 3. Create 'leads' table (CRM)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    ai_context TEXT,
    segment TEXT DEFAULT 'Cold',
    source TEXT DEFAULT 'Inbound call',
    last_contact TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create 'knowledge_base' table (RAG Context)
CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create 'campaigns' table (Outbound Dialing)
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    goal TEXT,
    status TEXT DEFAULT 'running',
    total_calls INTEGER DEFAULT 0,
    answered INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create 'appointments' table (Internal AI Calendar)
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    reason TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'Confirmed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
