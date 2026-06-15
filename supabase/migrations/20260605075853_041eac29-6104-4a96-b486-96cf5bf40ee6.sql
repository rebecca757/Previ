
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
