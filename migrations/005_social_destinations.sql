-- Additive merchant-configured social destinations. Existing QR and Google links remain unchanged.
ALTER TABLE location ADD COLUMN IF NOT EXISTS facebook_review_url text;
ALTER TABLE location ADD COLUMN IF NOT EXISTS instagram_handle text;
