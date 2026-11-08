-- Additive and idempotent: preserves all accounts, branding, locations and usage.
ALTER TABLE business ADD COLUMN IF NOT EXISTS questionnaire jsonb NOT NULL DEFAULT '{"items": []}'::jsonb;
