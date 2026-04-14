ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS whatsapp_status TEXT DEFAULT 'Pending';
