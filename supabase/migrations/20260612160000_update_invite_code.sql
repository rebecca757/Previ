-- Replace the initial beta invite code (migrate any older value to the current one).
-- Codes are validated uppercased in the app, so the stored code must be uppercase.
UPDATE invite_codes SET code = 'ALLEEREBBI2026!' WHERE code IN ('PREVI2026', 'ALLEeREBBI2026');
