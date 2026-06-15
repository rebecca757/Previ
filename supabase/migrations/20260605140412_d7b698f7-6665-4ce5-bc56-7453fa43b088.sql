
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
