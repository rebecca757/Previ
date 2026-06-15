ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS body_systems text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.health_memories ADD COLUMN IF NOT EXISTS body_systems text[] NOT NULL DEFAULT '{}'::text[];
CREATE INDEX IF NOT EXISTS idx_documents_body_systems ON public.documents USING GIN (body_systems);
CREATE INDEX IF NOT EXISTS idx_health_memories_body_systems ON public.health_memories USING GIN (body_systems);