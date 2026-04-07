-- Run this in Supabase SQL Editor to add missing columns to agent_settings
ALTER TABLE public.agent_settings
ADD COLUMN IF NOT EXISTS working_days JSONB DEFAULT '["Mon","Tue","Wed","Thu","Fri"]',
ADD COLUMN IF NOT EXISTS open_time TEXT DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS close_time TEXT DEFAULT '18:00',
ADD COLUMN IF NOT EXISTS non_working_dates JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS personality TEXT DEFAULT 'professional',
ADD COLUMN IF NOT EXISTS greeting_message TEXT DEFAULT '';
