-- ============================================================================
-- Prevì — SETUP COMPLETO DATABASE (eseguire UNA SOLA VOLTA)
-- Progetto: izvfdocvbgddoyrcwgbt
-- Incolla tutto questo nel SQL Editor di Supabase ed esegui.
--
-- Contiene, in ordine: tabelle, funzioni, trigger, policy RLS e storage.
-- NOTA: il vecchio sistema "managed_profiles" è stato ABBANDONATO e quindi
--       NON è incluso (sostituito da account_links, in fondo).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STORAGE — bucket privato per i documenti sanitari (usato da archivio.tsx)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('health-documents', 'health-documents', false)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- MIGRAZIONE: 20260604141956_f9444967-c2bc-4de1-ae54-3fd731139511.sql
-- ============================================================================

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  date_of_birth DATE,
  biological_sex TEXT,
  blood_type TEXT,
  allergies TEXT[] DEFAULT '{}',
  chronic_conditions TEXT[] DEFAULT '{}',
  medications TEXT[] DEFAULT '{}',
  onboarded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- DOCUMENTS
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  document_date DATE,
  source TEXT,
  facility_name TEXT,
  ai_summary TEXT,
  ai_full_interpretation TEXT,
  file_url TEXT,
  file_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own docs" ON public.documents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- HEALTH MEMORIES
CREATE TABLE public.health_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  body_part TEXT,
  event_date DATE,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'user_text',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_memories TO authenticated;
GRANT ALL ON public.health_memories TO service_role;
ALTER TABLE public.health_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own memories" ON public.health_memories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- BIOMETRIC HISTORY
CREATE TABLE public.biometric_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg NUMERIC(5,2),
  height_cm NUMERIC(5,2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.biometric_history TO authenticated;
GRANT ALL ON public.biometric_history TO service_role;
ALTER TABLE public.biometric_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own biometrics" ON public.biometric_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- AI FEEDBACK
CREATE TABLE public.ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  rating TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_feedback TO authenticated;
GRANT ALL ON public.ai_feedback TO service_role;
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own feedback" ON public.ai_feedback FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- CHAT MESSAGES
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages" ON public.chat_messages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- REMINDERS
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reminders" ON public.reminders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- AUTO-CREATE PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- MIGRAZIONE: 20260604142014_3f223248-4e76-4bbf-9492-7e51872a0347.sql
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Storage policies: users can manage objects under their own user-id folder
CREATE POLICY "users read own health docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'health-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "users upload own health docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'health-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "users update own health docs" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'health-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "users delete own health docs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'health-documents' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ============================================================================
-- MIGRAZIONE: 20260604144723_ec459201-01d2-4d70-9f5d-d88451f45ea9.sql
-- ============================================================================

ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS suggested_specialty text,
  ADD COLUMN IF NOT EXISTS suggested_timeframe text,
  ADD COLUMN IF NOT EXISTS linked_health_memory_id uuid,
  ADD COLUMN IF NOT EXISTS linked_document_id uuid,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';


-- ============================================================================
-- MIGRAZIONE: 20260605073635_6fcab13c-302e-4dcc-932c-e4ccc6a60638.sql
-- ============================================================================
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent','normal')); ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS priority_reason text;

-- ============================================================================
-- MIGRAZIONE: 20260605074444_b187d8df-7656-44fe-b1a1-b76022a1ffdd.sql
-- ============================================================================
CREATE TABLE public.monthly_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  month TEXT NOT NULL,
  summary_text TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_summaries TO authenticated;
GRANT ALL ON public.monthly_summaries TO service_role;
ALTER TABLE public.monthly_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own monthly summaries" ON public.monthly_summaries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_monthly_summaries_user_month ON public.monthly_summaries(user_id, month DESC);

-- ============================================================================
-- MIGRAZIONE: 20260605075021_bc3f3318-ec94-4fc7-939f-c155d7b7e67d.sql
-- ============================================================================
CREATE TABLE public.health_conditions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_conditions TO authenticated;
GRANT ALL ON public.health_conditions TO service_role;
ALTER TABLE public.health_conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own conditions" ON public.health_conditions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_health_condition_status() RETURNS TRIGGER AS $$
BEGIN
  NEW.status = CASE WHEN NEW.end_date IS NULL THEN 'active' ELSE 'resolved' END;
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_health_conditions_status
BEFORE INSERT OR UPDATE ON public.health_conditions
FOR EACH ROW EXECUTE FUNCTION public.set_health_condition_status();

CREATE INDEX idx_health_conditions_user ON public.health_conditions(user_id, start_date DESC);

-- ============================================================================
-- MIGRAZIONE: 20260605075853_041eac29-6104-4a96-b486-96cf5bf40ee6.sql
-- ============================================================================

CREATE TABLE public.family_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  relation TEXT NOT NULL,
  condition TEXT NOT NULL,
  onset_age INTEGER,
  is_deceased BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_history TO authenticated;
GRANT ALL ON public.family_history TO service_role;
ALTER TABLE public.family_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own family history" ON public.family_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS linked_family_history_id UUID;


-- ============================================================================
-- MIGRAZIONE: 20260605091132_e246643d-491c-4a64-9d35-33a5a0c0d338.sql
-- ============================================================================
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

-- ============================================================================
-- MIGRAZIONE: 20260605091223_0a446865-9aca-4ede-8d51-982953b61ced.sql
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.is_active_caregiver(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_family_linked(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_caregiver(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_family_linked(uuid, uuid) TO authenticated, service_role;

-- ============================================================================
-- MIGRAZIONE: 20260605094806_3e0363bf-7491-45da-ad8a-c242dbe68a6c.sql
-- ============================================================================
ALTER TABLE public.health_memories
  ADD COLUMN IF NOT EXISTS linked_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_documented BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edit_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_health_memories_linked_doc ON public.health_memories(linked_document_id);

-- ============================================================================
-- MIGRAZIONE: 20260605140412_d7b698f7-6665-4ce5-bc56-7453fa43b088.sql
-- ============================================================================

ALTER TABLE public.health_memories
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Backfill: any memory currently linked to a document becomes 'linked_to_document'
UPDATE public.health_memories
  SET status = 'linked_to_document'
  WHERE linked_document_id IS NOT NULL AND status = 'active';

-- Trigger to keep status in sync with linkage
CREATE OR REPLACE FUNCTION public.sync_health_memory_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'archived' THEN
    -- explicit archive wins
    NEW.is_documented := (NEW.linked_document_id IS NOT NULL);
    RETURN NEW;
  END IF;
  IF NEW.linked_document_id IS NOT NULL THEN
    NEW.status := 'linked_to_document';
    NEW.is_documented := true;
  ELSE
    IF NEW.status = 'linked_to_document' THEN
      NEW.status := 'active';
    END IF;
    NEW.is_documented := false;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_health_memory_status ON public.health_memories;
CREATE TRIGGER trg_sync_health_memory_status
BEFORE INSERT OR UPDATE ON public.health_memories
FOR EACH ROW EXECUTE FUNCTION public.sync_health_memory_status();


-- ============================================================================
-- MIGRAZIONE: 20260605141315_d44c8517-6697-4d9f-9648-9989b6012ed3.sql
-- ============================================================================
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS body_systems text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.health_memories ADD COLUMN IF NOT EXISTS body_systems text[] NOT NULL DEFAULT '{}'::text[];
CREATE INDEX IF NOT EXISTS idx_documents_body_systems ON public.documents USING GIN (body_systems);
CREATE INDEX IF NOT EXISTS idx_health_memories_body_systems ON public.health_memories USING GIN (body_systems);

-- ============================================================================
-- MIGRAZIONE: 20260609071756_c2390e64-a20b-4b21-83ed-b5d65f4dfa62.sql
-- ============================================================================

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS facility_type text,
  ADD COLUMN IF NOT EXISTS doctor_name text;

ALTER TABLE public.health_memories
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS facility_name text,
  ADD COLUMN IF NOT EXISTS facility_type text,
  ADD COLUMN IF NOT EXISTS doctor_name text;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_facility_type_check CHECK (facility_type IS NULL OR facility_type IN ('public','private'));

ALTER TABLE public.health_memories
  ADD CONSTRAINT health_memories_facility_type_check CHECK (facility_type IS NULL OR facility_type IN ('public','private'));


-- ============================================================================
-- MIGRAZIONE: 20260609074217_29ea0d4a-67d0-499c-aae1-9c1760a4fd8a.sql
-- ============================================================================

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_permanent_deletion_at timestamptz;

ALTER TABLE public.health_memories
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_permanent_deletion_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON public.documents(deleted_at);
CREATE INDEX IF NOT EXISTS idx_documents_scheduled_purge ON public.documents(scheduled_permanent_deletion_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_health_memories_deleted_at ON public.health_memories(deleted_at);
CREATE INDEX IF NOT EXISTS idx_health_memories_scheduled_purge ON public.health_memories(scheduled_permanent_deletion_at) WHERE deleted_at IS NOT NULL;


-- ============================================================================
-- MIGRAZIONE: 20260609083201_7449f60b-f604-463b-b902-cabf634b8678.sql
-- ============================================================================

-- 1) Family links: prevent self-appointment as another user's caregiver
DROP POLICY IF EXISTS "insert own family links" ON public.family_links;
CREATE POLICY "insert own family links"
ON public.family_links
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = managed_user_id);

-- 2) Profiles: scope SELECT to self or active caregiver only
DROP POLICY IF EXISTS "profiles select self caregiver or linked" ON public.profiles;
CREATE POLICY "profiles select self or caregiver"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.is_active_caregiver(auth.uid(), id));


-- ============================================================================
-- MIGRAZIONE: 20260609133227_394dc834-3d75-48dc-aa65-821e475635e7.sql
-- ============================================================================
-- 1. health_memories: scheduled auto-deletion 24h after linking + opt-out flag
ALTER TABLE public.health_memories
  ADD COLUMN IF NOT EXISTS scheduled_deletion_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kept_after_link BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_health_memories_scheduled_deletion
  ON public.health_memories(scheduled_deletion_at)
  WHERE scheduled_deletion_at IS NOT NULL AND deleted_at IS NULL;

-- 2. documents: preserve origin memory text after the memory is purged
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS linked_memory_description TEXT,
  ADD COLUMN IF NOT EXISTS linked_memory_notes TEXT;

-- 3. Trigger: when a memory becomes linked to a document, schedule deletion 24h later
CREATE OR REPLACE FUNCTION public.schedule_memory_deletion_on_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.kept_after_link = TRUE THEN
    NEW.scheduled_deletion_at := NULL;
    RETURN NEW;
  END IF;
  IF NEW.linked_document_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.linked_document_id IS DISTINCT FROM NEW.linked_document_id)
     AND NEW.scheduled_deletion_at IS NULL THEN
    NEW.scheduled_deletion_at := now() + INTERVAL '24 hours';
  ELSIF NEW.linked_document_id IS NULL THEN
    NEW.scheduled_deletion_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schedule_memory_deletion ON public.health_memories;
CREATE TRIGGER trg_schedule_memory_deletion
  BEFORE INSERT OR UPDATE ON public.health_memories
  FOR EACH ROW EXECUTE FUNCTION public.schedule_memory_deletion_on_link();

-- 4. family_links: management type for caregiver relationships
ALTER TABLE public.family_links
  ADD COLUMN IF NOT EXISTS management_type TEXT NOT NULL DEFAULT 'indefinite';

ALTER TABLE public.family_links
  DROP CONSTRAINT IF EXISTS family_links_management_type_check;
ALTER TABLE public.family_links
  ADD CONSTRAINT family_links_management_type_check
  CHECK (management_type IN ('indefinite', 'until_18'));

-- 5. reminders: tag for Ministero della Salute official guidelines
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS guideline_id TEXT;

-- ============================================================================
-- MIGRAZIONE: 20260609150227_3d6841ba-6012-4357-8701-649f7c8a7579.sql
-- ============================================================================
ALTER TABLE public.family_history ADD COLUMN IF NOT EXISTS condition_category text;

-- ============================================================================
-- MIGRAZIONE: 20260609151456_56d9f1f4-0289-4603-8ff2-7fb20db910a4.sql
-- ============================================================================
ALTER TABLE public.family_history ADD COLUMN IF NOT EXISTS relation_degree text;

-- ============================================================================
-- MIGRAZIONE: 20260611090158_f5b92c75-d207-4b5a-96fe-844bf247680b.sql
-- ============================================================================

CREATE TABLE public.medications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  dosage text,
  frequency text,
  linked_condition_id uuid REFERENCES public.health_conditions(id) ON DELETE SET NULL,
  reason text,
  start_date date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medications TO authenticated;
GRANT ALL ON public.medications TO service_role;

ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "self or caregiver" ON public.medications
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_active_caregiver(auth.uid(), user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_active_caregiver(auth.uid(), user_id));

CREATE TRIGGER medications_touch_updated_at
  BEFORE UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX medications_user_id_idx ON public.medications(user_id);
CREATE INDEX medications_linked_condition_id_idx ON public.medications(linked_condition_id);


-- ============================================================================
-- MIGRAZIONE: 20260611093414_0322da2c-da38-430e-99cf-5696698b54d8.sql
-- ============================================================================
ALTER TABLE public.medications ADD COLUMN IF NOT EXISTS requires_prescription boolean NOT NULL DEFAULT false;
ALTER TABLE public.medications ADD COLUMN IF NOT EXISTS prescription_type text;
ALTER TABLE public.medications ADD COLUMN IF NOT EXISTS prescription_expiry date;
ALTER TABLE public.medications ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.medications DROP CONSTRAINT IF EXISTS medications_prescription_type_check;
ALTER TABLE public.medications ADD CONSTRAINT medications_prescription_type_check CHECK (prescription_type IS NULL OR prescription_type IN ('standard','permanent','none'));
ALTER TABLE public.medications DROP CONSTRAINT IF EXISTS medications_status_check;
ALTER TABLE public.medications ADD CONSTRAINT medications_status_check CHECK (status IN ('active','suspended','discontinued'));

-- ============================================================================
-- MIGRAZIONE: 20260612120000_family_history_condition_categories.sql
-- ============================================================================
-- Backfill condition_category for all family_history rows using the expanded normalization rules.
-- New categories: stroke, arrhythmia, hypercholesterolemia, ovarian_cancer, endometrial_cancer,
--   pancreatic_cancer, melanoma, lung_cancer, alzheimer.
-- Also fixes existing records where ictus was incorrectly stored as cardiovascular_disease.
UPDATE public.family_history SET condition_category =
  CASE
    WHEN LOWER(condition) ~ '(ictus|stroke)'               THEN 'stroke'
    WHEN LOWER(condition) ~ '(fibrillaz|aritmia)'          THEN 'arrhythmia'
    WHEN LOWER(condition) ~ '(ovaio|ovarico)'              THEN 'ovarian_cancer'
    WHEN LOWER(condition) ~ '(pancrea)'                    THEN 'pancreatic_cancer'
    WHEN LOWER(condition) ~ '(endometrio|uterina|utero)'   THEN 'endometrial_cancer'
    WHEN LOWER(condition) ~ '(melanoma|cutaneo)'           THEN 'melanoma'
    WHEN LOWER(condition) ~ '(polmone|polmonare)'          THEN 'lung_cancer'
    WHEN LOWER(condition) ~ '(alzheimer|demenz)'           THEN 'alzheimer'
    WHEN LOWER(condition) ~ '(colesterol|ipercolesterol)'  THEN 'hypercholesterolemia'
    WHEN LOWER(condition) ~ '(infarto|cardio|coronar|bypass|cardiovasc|angina|cuore)' THEN 'cardiovascular_disease'
    WHEN LOWER(condition) ~ '(diabet)'                     THEN 'diabetes'
    WHEN LOWER(condition) ~ '(pressione|ipertens)'         THEN 'hypertension'
    WHEN LOWER(condition) ~ '(colon|retto|colorett|intestin|polipo)' THEN 'colorectal_cancer'
    WHEN LOWER(condition) ~ '(seno|mammell)'               THEN 'breast_cancer'
    WHEN LOWER(condition) ~ '(prostata)'                   THEN 'prostate_cancer'
    WHEN LOWER(condition) ~ '(osteoporos)'                 THEN 'osteoporosis'
    ELSE COALESCE(condition_category, 'other')
  END
WHERE true;


-- ============================================================================
-- MIGRAZIONE: 20260612150000_invite_codes.sql
-- ============================================================================
-- Invite code system for gated registration

CREATE TABLE invite_codes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text        UNIQUE NOT NULL,
  description  text,
  max_uses     integer     DEFAULT 10,
  current_uses integer     DEFAULT 0,
  active       boolean     DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

INSERT INTO invite_codes (code, description, max_uses)
VALUES ('ALLEEREBBI2026!', 'Beta tester - primo gruppo', 20);

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can read active codes to validate them
CREATE POLICY "Anyone can read active invite codes"
ON invite_codes FOR SELECT
USING (active = true);

-- Increment function — SECURITY DEFINER so it bypasses RLS for the UPDATE
CREATE OR REPLACE FUNCTION increment_invite_code(code_text text)
RETURNS void AS $$
  UPDATE invite_codes
  SET current_uses = current_uses + 1
  WHERE code = code_text;
$$ LANGUAGE sql SECURITY DEFINER;

-- Allow anon and authenticated callers to invoke the RPC
GRANT EXECUTE ON FUNCTION increment_invite_code(text) TO anon, authenticated;


-- ============================================================================
-- MIGRAZIONE: 20260612160000_update_invite_code.sql
-- ============================================================================
-- Replace the initial beta invite code (migrate any older value to the current one).
-- Codes are validated uppercased in the app, so the stored code must be uppercase.
UPDATE invite_codes SET code = 'ALLEEREBBI2026!' WHERE code IN ('PREVI2026', 'ALLEeREBBI2026');


-- ============================================================================
-- MIGRAZIONE: 20260615120000_chat_messages_document_link.sql
-- ============================================================================
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


-- ============================================================================
-- MIGRAZIONE: 20260616120000_account_links.sql
-- ============================================================================
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


-- ============================================================================
-- MIGRAZIONE: 20260619120000_conversations.sql
-- ============================================================================
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
