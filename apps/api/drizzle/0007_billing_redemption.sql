CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  revenuecat_app_user_id text NOT NULL,
  product_id text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'expired', 'billing_issue', 'paused')),
  entitlement_ids text[] NOT NULL DEFAULT '{}',
  purchased_at timestamptz NOT NULL,
  expires_at timestamptz,
  original_transaction_id text,
  store text NOT NULL DEFAULT 'APP_STORE',
  is_sandbox boolean NOT NULL DEFAULT false,
  cancel_reason text,
  grace_period_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, original_transaction_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS revenuecat_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  app_user_id text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS redemption_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  description text,
  max_uses integer DEFAULT 1 CHECK (max_uses IS NULL OR max_uses >= 0),
  current_uses integer NOT NULL DEFAULT 0 CHECK (current_uses >= 0),
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS redemption_codes_upper_code_idx ON redemption_codes(upper(code));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES redemption_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code_id, user_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS code_redemptions_user_id_idx ON code_redemptions(user_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS redemption_rate_limits (
  bucket timestamptz PRIMARY KEY,
  attempts integer NOT NULL CHECK (attempts >= 0)
);
