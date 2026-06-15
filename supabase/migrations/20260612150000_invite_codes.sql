-- Invite code system for gated registration

CREATE TABLE invite_codes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text        UNIQUE NOT NULL,
  description  text,
  max_uses     integer     DEFAULT 10,
  current_uses integer     DEFAULT 0,
  active       boolean     DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

INSERT INTO invite_codes (code, description, max_uses)
VALUES ('ALLEeREBBI2026', 'Beta tester - primo gruppo', 20);

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can read active codes to validate them
CREATE POLICY "Anyone can read active invite codes"
ON invite_codes FOR SELECT
USING (active = true);

-- Increment function — SECURITY DEFINER so it bypasses RLS for the UPDATE
CREATE OR REPLACE FUNCTION increment_invite_code(code_text text)
RETURNS void AS $$
  UPDATE invite_codes
  SET current_uses = current_uses + 1
  WHERE code = code_text;
$$ LANGUAGE sql SECURITY DEFINER;

-- Allow anon and authenticated callers to invoke the RPC
GRANT EXECUTE ON FUNCTION increment_invite_code(text) TO anon, authenticated;
