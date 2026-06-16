-- ============================================================
-- Prevì — Account linking semplice (account_links)
-- Sostituisce l'approccio managed_profiles: ogni persona ha il
-- proprio account; un utente può richiedere accesso all'account
-- di un altro utente registrato e, una volta accettato, switchare
-- tra i profili collegati.
--
-- Esegui nel SQL Editor di Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- PARTE 1 — Tabella account_links + RLS (la tabella richiesta)
-- ------------------------------------------------------------
-- owner_id        = chi richiede l'accesso (potrà vedere i dati dell'altro)
-- linked_user_id  = l'account a cui si chiede accesso (deve accettare)
CREATE TABLE IF NOT EXISTS public.account_links (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT account_links_no_self CHECK (owner_id <> linked_user_id),
  CONSTRAINT account_links_unique  UNIQUE (owner_id, linked_user_id)
);

CREATE INDEX IF NOT EXISTS account_links_owner_idx  ON public.account_links (owner_id);
CREATE INDEX IF NOT EXISTS account_links_linked_idx ON public.account_links (linked_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_links TO authenticated;
ALTER TABLE public.account_links ENABLE ROW LEVEL SECURITY;

-- Lettura: solo i due diretti interessati
DROP POLICY IF EXISTS "account_links_select" ON public.account_links;
CREATE POLICY "account_links_select" ON public.account_links
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR linked_user_id = auth.uid());

-- Inserimento (invio richiesta): solo come owner
DROP POLICY IF EXISTS "account_links_insert" ON public.account_links;
CREATE POLICY "account_links_insert" ON public.account_links
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Aggiornamento (accettare la richiesta): solo il destinatario
DROP POLICY IF EXISTS "account_links_update" ON public.account_links;
CREATE POLICY "account_links_update" ON public.account_links
  FOR UPDATE TO authenticated
  USING      (linked_user_id = auth.uid())
  WITH CHECK (linked_user_id = auth.uid());

-- Eliminazione (rimuovere/rifiutare): entrambi gli interessati
DROP POLICY IF EXISTS "account_links_delete" ON public.account_links;
CREATE POLICY "account_links_delete" ON public.account_links
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR linked_user_id = auth.uid());


-- ------------------------------------------------------------
-- PARTE 2 — Funzioni di supporto (richieste dalla UI)
-- ------------------------------------------------------------
-- Risolve un'email in user_id (profiles non ha l'email e auth.users
-- non è leggibile dal client) — usata dal pulsante "Collega".
CREATE OR REPLACE FUNCTION public.find_user_by_email(_email TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(trim(_email)) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.find_user_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_user_by_email(TEXT) TO authenticated;

-- Elenca i collegamenti dell'utente loggato con email + nome della
-- controparte (serve per mostrare le richieste in entrata/uscita, anche
-- quando il profilo della controparte non è ancora leggibile via RLS).
CREATE OR REPLACE FUNCTION public.list_account_links()
RETURNS TABLE (
  link_id          UUID,
  direction        TEXT,
  counterpart_id   UUID,
  counterpart_email TEXT,
  counterpart_name TEXT,
  status           TEXT,
  created_at       TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    al.id,
    CASE WHEN al.owner_id = auth.uid() THEN 'outgoing' ELSE 'incoming' END,
    CASE WHEN al.owner_id = auth.uid() THEN al.linked_user_id ELSE al.owner_id END,
    u.email::text,
    p.full_name,
    al.status,
    al.created_at
  FROM public.account_links al
  JOIN auth.users u
    ON u.id = CASE WHEN al.owner_id = auth.uid() THEN al.linked_user_id ELSE al.owner_id END
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE al.owner_id = auth.uid() OR al.linked_user_id = auth.uid()
  ORDER BY al.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.list_account_links() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_account_links() TO authenticated;


-- ------------------------------------------------------------
-- PARTE 3 — Accesso cross-account ai dati (RICHIESTO per lo switch)
-- Senza queste policy, switchare su un profilo collegato mostrerebbe
-- dati vuoti: le tabelle dati hanno RLS "solo i tuoi dati".
-- has_account_access(target) = true se l'utente loggato ha un
-- collegamento ACCETTATO verso "target".
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_account_access(_target UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_links
    WHERE owner_id = auth.uid()
      AND linked_user_id = _target
      AND status = 'accepted'
  );
$$;
REVOKE ALL ON FUNCTION public.has_account_access(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_account_access(UUID) TO authenticated;

-- Profili collegati: sola lettura
DROP POLICY IF EXISTS "linked_access_profiles" ON public.profiles;
CREATE POLICY "linked_access_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_account_access(id));

-- Tabelle dati (chiave user_id): lettura + gestione del profilo collegato.
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'documents', 'health_memories', 'health_conditions', 'medications',
    'allergies', 'family_history', 'reminders', 'biometric_history',
    'chat_messages', 'monthly_summaries'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Salta le tabelle non presenti (schema può variare)
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'linked_access_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      || 'USING (public.has_account_access(user_id)) '
      || 'WITH CHECK (public.has_account_access(user_id))',
      'linked_access_' || t, t
    );
  END LOOP;
END $$;
