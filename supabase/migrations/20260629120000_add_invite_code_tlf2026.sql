-- Add a new beta invite code (in addition to the existing one).
-- Codes are validated uppercased in the app, so the stored code must be uppercase.
INSERT INTO invite_codes (code, description, max_uses)
VALUES ('TLF2026', 'Beta tester - gruppo TLF', 20)
ON CONFLICT (code) DO NOTHING;
