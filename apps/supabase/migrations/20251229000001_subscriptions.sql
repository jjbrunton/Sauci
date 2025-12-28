-- Create subscription status enum
CREATE TYPE public.subscription_status AS ENUM (
  'active',
  'cancelled',
  'expired',
  'billing_issue',
  'paused'
);

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  revenuecat_app_user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  status public.subscription_status NOT NULL DEFAULT 'active',
  entitlement_ids TEXT[] DEFAULT '{}',
  purchased_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  original_transaction_id TEXT,
  store TEXT DEFAULT 'APP_STORE',
  is_sandbox BOOLEAN DEFAULT FALSE,
  cancel_reason TEXT,
  grace_period_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, original_transaction_id)
);

-- Create webhook events table for idempotency
CREATE TABLE public.revenuecat_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  app_user_id TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);

-- Indexes
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_expires_at ON public.subscriptions(expires_at);
CREATE INDEX idx_webhook_events_event_id ON public.revenuecat_webhook_events(event_id);

-- Update updated_at trigger for subscriptions
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenuecat_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role only for webhook events (no user access needed)
-- Webhook events are written by service role only

-- Function to sync is_premium flag to profiles
CREATE OR REPLACE FUNCTION public.sync_premium_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the profile's is_premium based on active subscription
  UPDATE public.profiles
  SET is_premium = EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = NEW.user_id
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > NOW())
  )
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-sync premium status on subscription changes
CREATE TRIGGER sync_premium_on_subscription_change
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_premium_status();
