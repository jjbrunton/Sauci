# Redemption codes

Promotional codes are redeemed only through `apps/web/app/redeem/page.tsx`.
Do not add redemption UI or a redemption call to the mobile app: mobile premium
access is governed by the platform purchase/RevenueCat flow.

The public web form calls `redeem-code`, which delegates the atomic validation and
grant to `redeem_code_by_email`. The database boundary validates active state,
expiry, remaining uses, and prior redemption before changing premium status.

Changes require web E2E coverage for validation and success/error states plus a
Supabase integration assertion for the resulting profile and redemption record.
