ALTER TABLE public.health_memories
  ADD COLUMN IF NOT EXISTS linked_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_documented BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edit_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_health_memories_linked_doc ON public.health_memories(linked_document_id);