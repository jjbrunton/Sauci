# Subscription & Premium System

This document explains how subscriptions and premium access work across the client, server, and database layers.

## Overview

Sauci uses RevenueCat for subscription management with a multi-layer architecture:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Mobile App    │────▶│    RevenueCat    │────▶│  Supabase Edge  │
│  (RevenueCat    │     │     Service      │     │    Functions    │
│     SDK)        │◀────│                  │◀────│                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │    Database     │
                                                 │  (is_premium)   │
                                                 └─────────────────┘
```

## Components

### 1. Client SDK (`src/lib/revenuecat.ts`)

The `RevenueCatService` class wraps the `react-native-purchases` SDK.

**Platform Support:**
- iOS: Full support with native SDK
- Android: Not yet implemented
- Web/Expo Go: Gracefully disabled (returns defaults)

**Key Methods:**

| Method | Purpose |
|--------|---------|
| `initialize(userId)` | Configure SDK with API key and user ID |
| `login(userId)` | Associate purchases with Supabase user |
| `getOfferings()` | Fetch available subscription packages |
| `purchasePackage(pkg)` | Initiate purchase flow |
| `restorePurchases()` | Restore previous purchases |
| `getCustomerInfo()` | Get current subscription status |
| `parseCustomerInfo()` | Convert to `SubscriptionState` |

**Entitlement Check:**
```typescript
const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
return {
    isProUser: !!entitlement,
    activeSubscription: entitlement?.productIdentifier || null,
    expirationDate: entitlement?.expirationDate ? new Date(...) : null,
    willRenew: entitlement?.willRenew || false,
};
```

### 2. Zustand Store (`src/store/index.ts`)

The `useSubscriptionStore` manages subscription state in the app:

```typescript
interface SubscriptionStoreState {
    subscription: SubscriptionState;
    offerings: PurchasesOffering | null;
    isLoadingOfferings: boolean;
    isPurchasing: boolean;
    error: string | null;
}
```

**Key Actions:**
- `initializeRevenueCat(userId)` - Called after auth, sets up SDK
- `fetchOfferings()` - Loads available packages for paywall
- `purchasePackage(pkg)` - Handles purchase with error handling
- `restorePurchases()` - Restores and syncs to server
- `refreshSubscriptionStatus()` - Checks RevenueCat and syncs to server

### 3. Webhook Handler (`functions/revenuecat-webhook`)

RevenueCat sends webhook events for subscription lifecycle changes.

**Event Types Handled:**

| Event | Status Set |
|-------|------------|
| `INITIAL_PURCHASE` | `active` |
| `RENEWAL` | `active` |
| `UNCANCELLATION` | `active` |
| `PRODUCT_CHANGE` | `active` |
| `CANCELLATION` | `cancelled` |
| `EXPIRATION` | `expired` |
| `BILLING_ISSUE` | `billing_issue` |
| `SUBSCRIPTION_PAUSED` | `paused` |

**Idempotency:**
Events are logged to `revenuecat_webhook_events` table with unique `event_id` to prevent duplicate processing.

**Flow:**
```
1. Verify webhook secret (Authorization header)
2. Check for duplicate event_id
3. Record event in webhook_events table
4. Upsert subscription record
5. Database trigger syncs is_premium to profiles
```

### 4. Sync Function (`functions/sync-subscription`)

Called from client to verify subscription status server-side.

**When Called:**
- After purchase completes
- On app foreground (if status differs)
- Manual restore purchases

**Flow:**
```
1. Verify user JWT
2. Call RevenueCat API: GET /v1/subscribers/{user_id}
3. Check entitlement expiration date
4. Update profiles.is_premium
```

### 5. Database Layer

**Tables:**

```sql
-- Main subscription record
subscriptions (
    user_id UUID FK profiles,
    product_id TEXT,
    status subscription_status,  -- active/cancelled/expired/billing_issue/paused
    expires_at TIMESTAMPTZ,
    ...
)

-- Idempotency tracking
revenuecat_webhook_events (
    event_id TEXT UNIQUE,
    event_type TEXT,
    app_user_id TEXT,
    payload JSONB
)
```

**Auto-Sync Trigger:**
```sql
CREATE TRIGGER sync_premium_on_subscription_change
    AFTER INSERT OR UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.sync_premium_status();
```

This trigger updates `profiles.is_premium` based on active subscription status.

## Premium Access Logic

### Partner Premium Sharing

If either partner in a couple has premium, both get access:

```sql
CREATE FUNCTION public.has_premium_access(check_user_id UUID)
RETURNS BOOLEAN AS $$
    -- Returns TRUE if user OR their partner has is_premium = TRUE
$$;
```

### RLS Policies

Premium packs are filtered at the database level:

```sql
CREATE POLICY "Users or partners with premium can view premium packs"
    ON public.question_packs FOR SELECT
    USING (
        is_premium = FALSE OR
        EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND (p.is_premium = TRUE OR EXISTS (
                SELECT 1 FROM profiles partner
                WHERE partner.couple_id = p.couple_id
                AND partner.is_premium = TRUE
            ))
        )
    );
```

### Question Filtering

The `get_recommended_questions()` function also filters premium packs:

```sql
-- Only include packs where:
(qp.is_premium = FALSE OR v_has_premium = TRUE)
```

## Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | Mobile app | RevenueCat public SDK key |
| `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` | Mobile app | Entitlement identifier (default: "pro") |
| `REVENUECAT_API_KEY` | Edge functions | RevenueCat secret API key |
| `REVENUECAT_ENTITLEMENT_ID` | Edge functions | Server-side entitlement check |
| `REVENUECAT_WEBHOOK_SECRET` | Edge functions | Webhook auth verification |

## Subscription Flow Diagrams

### Purchase Flow

```
User taps Subscribe
        │
        ▼
┌───────────────────┐
│ fetchOfferings()  │
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ Display Paywall   │
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ purchasePackage() │──▶ Native App Store UI
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ RevenueCat SDK    │──▶ Sends webhook to server
│ returns success   │
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ refreshStatus()   │──▶ Calls sync-subscription
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ fetchUser()       │──▶ UI shows premium features
└───────────────────┘
```

### Webhook Flow

```
RevenueCat Event (e.g., RENEWAL)
        │
        ▼
┌───────────────────────┐
│ revenuecat-webhook    │
│ Edge Function         │
└─────────┬─────────────┘
          │
          ├──▶ Check event_id (idempotency)
          │
          ├──▶ Record in webhook_events
          │
          ▼
┌───────────────────────┐
│ UPSERT subscriptions  │
└─────────┬─────────────┘
          │
          ▼
┌───────────────────────┐
│ sync_premium_status() │──▶ Updates profiles.is_premium
│ (Database Trigger)    │
└───────────────────────┘
```

## Testing

RevenueCat sandbox mode is detected via `event.environment !== "PRODUCTION"` and stored in `subscriptions.is_sandbox`.

To test webhooks locally:
```bash
# Use ngrok or similar to expose local Supabase
supabase functions serve revenuecat-webhook --env-file .env.local
```
