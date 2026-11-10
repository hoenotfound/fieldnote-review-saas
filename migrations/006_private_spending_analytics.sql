-- Optional self-reported spend is private analytics, never draft text.
-- Safe additive migration. Historical generations remain NULL (unknown).
ALTER TABLE generation
  ADD COLUMN IF NOT EXISTS spend_rm numeric(10,2) CHECK (spend_rm BETWEEN 0 AND 100000);

-- Separate opt-in reporting for customers who write without AI.
-- No draft text, names, devices or other identifiable details are saved here.
CREATE TABLE IF NOT EXISTS manual_spending (
  guest_id text PRIMARY KEY REFERENCES guest_session(id) ON DELETE CASCADE,
  business_id text NOT NULL REFERENCES business(id),
  location_id text NOT NULL,
  spend_rm numeric(10,2) NOT NULL CHECK (spend_rm BETWEEN 0 AND 100000),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(business_id,location_id) REFERENCES location(business_id,id)
);
CREATE INDEX IF NOT EXISTS manual_spending_business_idx ON manual_spending(business_id, recorded_at);

