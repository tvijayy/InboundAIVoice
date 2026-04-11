-- Run this in your Supabase SQL Editor to enable Omni-channel Notifications Tracking

-- 1. Add notification tracking columns directly to the existing appointments table
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS confirmation_sent BOOLEAN DEFAULT false;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS missed_notified BOOLEAN DEFAULT false;

-- 2. Add Resend integration support structure to the dummy integrations table
-- (Allows using the existing integrations table to hold RESEND_API_KEY securely)
-- Assuming 'provider' holds 'resend'. No schema changes needed for the table itself, 
-- but this comment reminds you to insert it via UI.
