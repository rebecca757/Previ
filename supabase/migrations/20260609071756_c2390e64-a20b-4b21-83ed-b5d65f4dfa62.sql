
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
