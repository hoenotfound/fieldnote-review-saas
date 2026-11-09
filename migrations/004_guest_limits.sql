-- Additive only. Existing customer sessions and generation records remain intact.
ALTER TABLE guest_session ADD COLUMN IF NOT EXISTS network_key text;
ALTER TABLE guest_session ADD COLUMN IF NOT EXISTS client_key text;

CREATE TABLE IF NOT EXISTS guest_rate_counter (
  scope text NOT NULL,
  key_hash text NOT NULL,
  window_key bigint NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key_hash, window_key)
);
CREATE INDEX IF NOT EXISTS guest_rate_counter_age_idx ON guest_rate_counter(created_at);

CREATE TABLE IF NOT EXISTS business_daily_budget (
  business_id text NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  day date NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  PRIMARY KEY (business_id, day)
);
