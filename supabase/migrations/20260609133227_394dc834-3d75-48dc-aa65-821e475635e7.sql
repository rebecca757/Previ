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