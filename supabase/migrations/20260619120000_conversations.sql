-- ============================================================
-- Prevì — Conversazioni chat recuperabili
-- Finora i messaggi erano un unico stream per-utente (con document_id
-- opzionale). Introduciamo conversazioni distinte e riapribili, con
-- collegamento opzionale a un documento (referto).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL DEFAULT 'Nuova conversazione',
  document_id  UUID        REFERENCES public.documents(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own conversations" ON public.conversations;
CREATE POLICY "own conversations" ON public.conversations FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Accesso cross-account (account collegati accettati), coerente con le altre tabelle.
DROP POLICY IF EXISTS "linked_access_conversations" ON public.conversations;
CREATE POLICY "linked_access_conversations" ON public.conversations FOR ALL TO authenticated
  USING (public.has_account_access(user_id))
  WITH CHECK (public.has_account_access(user_id));

CREATE INDEX IF NOT EXISTS conversations_user_updated_idx
  ON public.conversations (user_id, updated_at DESC);

-- Lega ogni messaggio a una conversazione.
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS chat_messages_conversation_id_idx
  ON public.chat_messages (conversation_id);
