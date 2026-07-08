-- Prevì — "Visite" (ex Prevenzione)
-- Aggiunge il luogo della visita ai promemoria. La data è già gestita da due_date.
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS location text;
