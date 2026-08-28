# Redemption codes

Promotional codes are redeemed only through `apps/web/app/redeem/page.tsx`.
Do not add redemption UI or a redemption call to the mobile app: mobile premium
access is governed by the platform purchase/RevenueCat flow.

The public web form calls `POST /public/v1/redemptions` on the standalone API.
The Node/Postgres boundary validates active state, expiry, remaining uses, and
prior redemption in one transaction before changing premium status.

Changes require web E2E coverage for validation and success/error states plus a
Postgres integration assertion for the resulting profile and redemption record.
