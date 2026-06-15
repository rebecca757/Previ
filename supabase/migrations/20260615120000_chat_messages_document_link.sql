-- Link chat messages to a source document so conversations about a specific
-- referto can be scoped and retrieved later.
--
-- Model: a single flat per-user message stream tagged with an optional document_id.
--   - document_id IS NULL  → general assistant chat (existing rows, backward compatible)
--   - document_id = <doc>  → a conversation about that referto
--
-- No new table / no thread management: the existing RLS ("own messages" /
-- "self or caregiver", both keyed on user_id) already governs access.

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE;

-- Speeds up the per-document conversation lookup and the "any messages on this referto?" check.
CREATE INDEX IF NOT EXISTS chat_messages_document_id_idx
  ON public.chat_messages (document_id)
  WHERE document_id IS NOT NULL;
