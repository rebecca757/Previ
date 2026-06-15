-- ============ FAMILY LINKS ============
CREATE TABLE public.family_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_user_id uuid NOT NULL,
  managed_user_id uuid NOT NULL,
  relation text NOT NULL,
  link_type text NOT NULL CHECK (link_type IN ('caregiver','genetic')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (caregiver_user_id, managed_user_id, link_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_links TO authenticated;
GRANT ALL ON public.family_links TO service_role;
ALTER TABLE public.family_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own family links" ON public.family_links FOR SELECT
  USING (auth.uid() = caregiver_user_id OR auth.uid() = managed_user_id);
CREATE POLICY "insert own family links" ON public.family_links FOR INSERT
  WITH CHECK (auth.uid() = caregiver_user_id OR auth.uid() = managed_user_id);
CREATE POLICY "update own family links" ON public.family_links FOR UPDATE
  USING (auth.uid() = caregiver_user_id OR auth.uid() = managed_user_id);
CREATE POLICY "delete own family links" ON public.family_links FOR DELETE
  USING (auth.uid() = caregiver_user_id OR auth.uid() = managed_user_id);

-- ============ FAMILY INVITES ============
CREATE TABLE public.family_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_user_id uuid NOT NULL,
  invitee_email text NOT NULL,
  relation text NOT NULL,
  link_type text NOT NULL DEFAULT 'genetic' CHECK (link_type IN ('caregiver','genetic')),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_invites TO authenticated;
GRANT ALL ON public.family_invites TO service_role;
ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own invites (sender or invitee)" ON public.family_invites FOR SELECT
  USING (
    auth.uid() = inviter_user_id
    OR lower(invitee_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );
CREATE POLICY "insert own invites" ON public.family_invites FOR INSERT
  WITH CHECK (auth.uid() = inviter_user_id);
CREATE POLICY "update invites (sender cancels, invitee responds)" ON public.family_invites FOR UPDATE
  USING (
    auth.uid() = inviter_user_id
    OR lower(invitee_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );
CREATE POLICY "delete own invites" ON public.family_invites FOR DELETE
  USING (auth.uid() = inviter_user_id);

-- ============ HELPER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.is_active_caregiver(_caregiver uuid, _managed uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_links
    WHERE caregiver_user_id = _caregiver
      AND managed_user_id = _managed
      AND link_type = 'caregiver'
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_family_linked(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_links
    WHERE status = 'active'
      AND ((caregiver_user_id = _a AND managed_user_id = _b)
        OR (caregiver_user_id = _b AND managed_user_id = _a))
  );
$$;

CREATE TRIGGER family_links_updated_at BEFORE UPDATE ON public.family_links
  FOR EACH ROW EXECUTE FUNCTION public.set_health_condition_status();
-- Note: reuses generic updated_at, but set_health_condition_status sets status too. Use simple touch:
DROP TRIGGER family_links_updated_at ON public.family_links;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER family_links_touch BEFORE UPDATE ON public.family_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ EXTEND RLS FOR CAREGIVER ACCESS ============
-- profiles: caregiver can read+update managed profile; any linked family can SELECT
DROP POLICY IF EXISTS "own profile" ON public.profiles;
CREATE POLICY "profiles select self caregiver or linked" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_active_caregiver(auth.uid(), id) OR public.is_family_linked(auth.uid(), id));
CREATE POLICY "profiles insert self" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles update self or caregiver" ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_active_caregiver(auth.uid(), id));
CREATE POLICY "profiles delete self" ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- generic extender macro: for each user-data table replace "own X" with caregiver-aware policy
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'documents','health_memories','reminders','biometric_history',
    'health_conditions','family_history','monthly_summaries','chat_messages','ai_feedback'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'own ' ||
      CASE t
        WHEN 'documents' THEN 'docs'
        WHEN 'health_memories' THEN 'memories'
        WHEN 'reminders' THEN 'reminders'
        WHEN 'biometric_history' THEN 'biometrics'
        WHEN 'health_conditions' THEN 'conditions'
        WHEN 'family_history' THEN 'family history'
        WHEN 'monthly_summaries' THEN 'monthly summaries'
        WHEN 'chat_messages' THEN 'messages'
        WHEN 'ai_feedback' THEN 'feedback'
      END, t);
    EXECUTE format($f$
      CREATE POLICY "self or caregiver" ON public.%I FOR ALL
      USING (auth.uid() = user_id OR public.is_active_caregiver(auth.uid(), user_id))
      WITH CHECK (auth.uid() = user_id OR public.is_active_caregiver(auth.uid(), user_id))
    $f$, t);
  END LOOP;
END $$;