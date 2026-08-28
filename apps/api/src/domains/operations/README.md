# Operations worker

`src/workers/index.ts` is the runtime for scheduled and asynchronous operations.
It polls every 30 seconds by default, bounds each claim, and uses a Postgres
advisory lock for producers plus `FOR UPDATE SKIP LOCKED` for delivery. Provider
work is represented by an `operations_outbox` row with a unique dedupe key.
Failed work retries with exponential backoff up to five attempts.

The worker replaces scheduled releases, streak milestones, session/match
digests, message notifications, pack-change notifications, weekly summaries,
unpaired and catch-up reminders, message classification, and product-used
Discord events. The older one-hour partner-activity sender and generic match
sender are consolidated into the five-minute session digest because the legacy
pair produced duplicate notifications for the same response session.

Pack writes must call the local SQL function
`queue_pack_change(couple_id, authenticated_user_id)` after enabling a pack.
The function verifies couple membership and applies the 30-minute debounce.

Classification defaults on. Production startup fails closed without
`OPENROUTER_API_KEY`; encrypted messages additionally require
`ADMIN_PRIVATE_KEY_JWK`. Provider calls are bounded and have timeouts. Expo
ticket-level errors are failures, and each notification includes the stable
outbox ID as `notification_id` for client deduplication.

The worker invokes the existing filesystem `MediaJanitor`; it does not recreate
the legacy Supabase Storage cleanup. Run only one janitor owner in production.
When the worker service is enabled, disable the API-process janitor to avoid
redundant scans. Deletion remains idempotent if both briefly overlap at rollout.

