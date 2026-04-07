-- Run this in your Supabase SQL Editor to support the new UI pages

CREATE TABLE IF NOT EXISTS public.integrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    provider TEXT UNIQUE NOT NULL,
    api_key TEXT,
    meta_data JSONB
);

-- Note: Ensure anonymous or authenticated users can access this table as per your global RLS, or disable RLS for local testing:
ALTER TABLE public.integrations DISABLE ROW LEVEL SECURITY;
