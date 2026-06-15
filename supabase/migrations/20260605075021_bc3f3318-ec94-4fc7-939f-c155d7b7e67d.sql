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