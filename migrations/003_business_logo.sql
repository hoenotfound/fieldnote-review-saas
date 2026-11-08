-- One small, processed public logo per business. Customer photos are never stored.
CREATE TABLE IF NOT EXISTS business_logo (
  business_id text PRIMARY KEY REFERENCES business(id) ON DELETE CASCADE,
  data bytea NOT NULL CHECK (octet_length(data) <= 98304),
  version text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
