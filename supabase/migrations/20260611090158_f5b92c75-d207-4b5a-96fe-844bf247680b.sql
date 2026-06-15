
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
