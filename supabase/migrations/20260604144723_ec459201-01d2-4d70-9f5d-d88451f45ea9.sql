
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS suggested_specialty text,
  ADD COLUMN IF NOT EXISTS suggested_timeframe text,
  ADD COLUMN IF NOT EXISTS linked_health_memory_id uuid,
  ADD COLUMN IF NOT EXISTS linked_document_id uuid,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
