-- User language preference (UI + AI responses). Defaults to Italian.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'it';

-- Constrain to supported languages.
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_language_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_preferred_language_check
  CHECK (preferred_language IN ('it', 'en'));
