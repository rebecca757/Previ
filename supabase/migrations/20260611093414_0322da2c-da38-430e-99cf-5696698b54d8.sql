ALTER TABLE public.medications ADD COLUMN IF NOT EXISTS requires_prescription boolean NOT NULL DEFAULT false;
ALTER TABLE public.medications ADD COLUMN IF NOT EXISTS prescription_type text;
ALTER TABLE public.medications ADD COLUMN IF NOT EXISTS prescription_expiry date;
ALTER TABLE public.medications ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.medications DROP CONSTRAINT IF EXISTS medications_prescription_type_check;
ALTER TABLE public.medications ADD CONSTRAINT medications_prescription_type_check CHECK (prescription_type IS NULL OR prescription_type IN ('standard','permanent','none'));
ALTER TABLE public.medications DROP CONSTRAINT IF EXISTS medications_status_check;
ALTER TABLE public.medications ADD CONSTRAINT medications_status_check CHECK (status IN ('active','suspended','discontinued'));