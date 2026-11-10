-- Optional self-reported spend is private analytics, never draft text.
-- Safe additive migration. Historical generations remain NULL (unknown).
ALTER TABLE generation
  ADD COLUMN IF NOT EXISTS spend_rm numeric(10,2) CHECK (spend_rm BETWEEN 0 AND 100000);
