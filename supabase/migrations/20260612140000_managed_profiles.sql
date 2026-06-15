-- Multi-profile (caregiver) system
-- Creates managed_profiles table and adapts 7 data tables to support records
-- owned by a managed profile (no auth account) vs. a direct auth user.

-- 1. managed_profiles table
CREATE TABLE IF NOT EXISTS public.managed_profiles (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  date_of_birth  DATE,
  sex            TEXT        CHECK (sex IN ('M', 'F')),
  relation       TEXT        NOT NULL,
  blood_type     TEXT,
  notes          TEXT,
  avatar_color   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.managed_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managed_profiles_owner_all" ON public.managed_profiles
  USING  (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- 2. Add managed_profile_id FK to the 7 data tables
ALTER TABLE public.documents        ADD COLUMN IF NOT EXISTS managed_profile_id UUID REFERENCES public.managed_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.health_memories  ADD COLUMN IF NOT EXISTS managed_profile_id UUID REFERENCES public.managed_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.health_conditions ADD COLUMN IF NOT EXISTS managed_profile_id UUID REFERENCES public.managed_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.medications       ADD COLUMN IF NOT EXISTS managed_profile_id UUID REFERENCES public.managed_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.family_history    ADD COLUMN IF NOT EXISTS managed_profile_id UUID REFERENCES public.managed_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.reminders         ADD COLUMN IF NOT EXISTS managed_profile_id UUID REFERENCES public.managed_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.biometric_history ADD COLUMN IF NOT EXISTS managed_profile_id UUID REFERENCES public.managed_profiles(id) ON DELETE CASCADE;

-- 3. Drop NOT NULL on user_id so managed-profile records can omit it
ALTER TABLE public.documents        ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.health_memories  ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.health_conditions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.medications       ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.family_history    ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.reminders         ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.biometric_history ALTER COLUMN user_id DROP NOT NULL;

-- 4. New RLS policies: owner can access records belonging to their managed profiles
CREATE POLICY "managed_profile_owner_documents" ON public.documents
  USING  (managed_profile_id IN (SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()))
  WITH CHECK (managed_profile_id IN (SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()));

CREATE POLICY "managed_profile_owner_health_memories" ON public.health_memories
  USING  (managed_profile_id IN (SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()))
  WITH CHECK (managed_profile_id IN (SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()));

CREATE POLICY "managed_profile_owner_health_conditions" ON public.health_conditions
  USING  (managed_profile_id IN (SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()))
  WITH CHECK (managed_profile_id IN (SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()));

CREATE POLICY "managed_profile_owner_medications" ON public.medications
  USING  (managed_profile_id IN (SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()))
  WITH CHECK (managed_profile_id IN (SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()));

CREATE POLICY "managed_profile_owner_family_history" ON public.family_history
  USING  (managed_profile_id IN (SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()))
  WITH CHECK (managed_profile_id IN (SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()));

CREATE POLICY "managed_profile_owner_reminders" ON public.reminders
  USING  (managed_profile_id IN (SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()))
  WITH CHECK (managed_profile_id IN (SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()));

CREATE POLICY "managed_profile_owner_biometric_history" ON public.biometric_history
  USING  (managed_profile_id IN (SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()))
  WITH CHECK (managed_profile_id IN (SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()));
