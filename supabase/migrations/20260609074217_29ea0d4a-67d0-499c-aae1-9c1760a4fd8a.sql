
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
