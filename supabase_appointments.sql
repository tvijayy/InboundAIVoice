-- Run this in your Supabase SQL Editor to support AI Calendar Syncing

CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    notes TEXT,
    source TEXT DEFAULT 'ai_voice',
    status TEXT DEFAULT 'confirmed',
    booking_uid TEXT -- Captures Cal.com's remote ID to allow future cancellations
);

-- Note: Ensure anonymous or authenticated users can access this table as per your global RLS
ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;
