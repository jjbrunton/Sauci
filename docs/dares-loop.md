# Dares loop

Maintained reference for the dares feature: a couple sends each other challenges,
each state change notifies the other partner, and the pair keeps a shared count of
what they have finished together.

The asynchronous shape is the point. Every transition below is a push notification
to whichever partner is not holding the app.

## Ownership

| Concern | Location |
|---|---|
| Schema, triggers, review parity | `apps/api/drizzle/0013_dares_loop.sql` |
| HTTP contract | `apps/api/src/domains/dares/routes.ts` |
| Domain rules and entitlement | `apps/api/src/domains/dares/repository.ts` |
| Expiry sweep | `apps/api/src/domains/operations/repository.ts` (`produce`) |
| Mobile feature | `apps/mobile/src/features/dares/` |
| Catalogue authoring | `apps/admin/src/pages/content/DarePacksPage.tsx`, `DaresPage.tsx` |

## State machine

```
                  ┌── decline ──► declined
pending ──accept──┤
   │              └── accept ───► active ──submit──► submitted ──confirm──► completed
   │                                 │                   │
   └──────────────── cancel ─────────┴───────────────────┘──► cancelled
                     (sender only, before completion)

any open status + expires_at in the past ──► expired   (worker sweep)
```

Actor rules are enforced server-side, not by hiding buttons:

| Transition | Who | Legal from |
|---|---|---|
| accept / decline | recipient | `pending` |
| submit | recipient | `active` |
| complete | sender | `active`, `submitted` |
| cancel | sender | `pending`, `active`, `submitted` |

The recipient performs the dare, so the recipient reports it done (`submitted`) and
the sender confirms (`completed`). An illegal transition returns `409
invalid_transition`; acting on someone else's dare returns `403 not_permitted`;
a dare outside your couple returns `404`, never a hint that it exists.

## Entitlement

Premium is couple-shared — either partner's subscription unlocks both, matching the
answers domain.

| Tier | Can do |
|---|---|
| Anyone, always | Receive, accept, decline, submit, complete, cancel |
| Free sender | Free packs, `FREE_WEEKLY_SEND_LIMIT` sends per rolling 7 days |
| Premium | All packs, unlimited sends, custom dares |

**Receiving is never gated.** A paywall between a partner and the dare they were just
notified about would break the loop the feature exists to create. The quota is counted
per sender over a rolling window, and counts every send — cancelling does not refund it.

## Content safety

`dare_packs` and `dares` carry `content_status` (`unreviewed` / `allowed` / `archived`),
matching the legacy catalogue contract. The catalogue, the pack detail endpoint, and the
send path each independently require `allowed`, so a stale client cannot send unreviewed
content. New content defaults to `unreviewed` and is therefore invisible until an
administrator reviews it.

Push copy is deliberately generic — `"Your partner sent you a dare"`, never the dare
text. Store compliance forbids question, dare, response, or message text in a
notification preview, and `dares.integration.test.ts` asserts no payload leaks it.

## History durability

`sent_dares` snapshots `dare_text_snapshot` and `dare_intensity_snapshot` at send time.
Editing, archiving, or deleting a catalogue dare never rewrites what a couple was
actually dared. This also fixes a latent defect: `dare_id` is `ON DELETE SET NULL`, and
the old `sent_dares_dare_or_custom_check` made deleting any dare that had been sent fail
with a check violation.

## Notifications

`queue_dare_operations` (trigger on `sent_dares`) writes one `operations_outbox` row per
transition with dedupe key `dare:<id>:<event>:<recipient>`, gated on
`notification_preferences.dares_enabled`. Delivery, retry, and Expo ticket handling are
the existing worker's job — see `apps/api/src/domains/operations/README.md`.

`expired` notifies both partners; every other transition notifies the one partner who
did not cause it.

## Expiry

The worker's `produce` pass expires any dare whose `expires_at` has passed while still
`pending`, `active`, or `submitted`, reported as `daresExpired` in `ProducerSummary`.
Pending is included deliberately: an invitation the recipient never opened would
otherwise stay open forever.

Durations offered to the client are fixed presets (1, 6, 12, 24, 72, 168 hours, or none)
and validated server-side.

## HTTP contract

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/dares/packs` | Catalogue plus the caller's entitlement |
| GET | `/v1/dares/packs/:packId/dares` | `402` when the pack is premium and the couple is not |
| GET | `/v1/dares?filter=active\|history` | Couple-scoped; `direction` is relative to the caller |
| GET | `/v1/dares/stats` | Shared scoreboard |
| GET | `/v1/dares/durations` | Preset list the send sheet renders |
| POST | `/v1/dares` | `dare_id` **or** `custom_dare_text`, never both |
| POST | `/v1/dares/:dareId/respond` | `{ action: "accept" \| "decline" }` |
| POST | `/v1/dares/:dareId/submit` | Recipient reports done |
| POST | `/v1/dares/:dareId/complete` | Sender confirms |
| POST | `/v1/dares/:dareId/cancel` | Sender withdraws |

The actor always comes from the bearer identity; ownership fields in a request body are
rejected.

## Mobile

Reached from the home screen's `DaresTile`, which badges pending incoming dares. The
screen has Active / Send / History tabs and opens the paywall both proactively and in
reaction to a `402` — a client whose entitlement went stale still lands on the paywall
rather than an error.

There is no realtime channel, so the screen polls on a 5s interval — but only while it is
focused and the app is foregrounded, and each pass reads the active list alone. History,
the catalogue and the stats are re-read only when the active set's ids or statuses
actually changed, or on an explicit refresh or a mutation. See
[Client data freshness](architecture/client-data-freshness.md).

## Tests

- `apps/api/test/dares.integration.test.ts` — real PostgreSQL: entitlement, quota,
  transitions, couple isolation, notification fan-out, no-text-in-push, snapshot durability
- `apps/api/test/dares.routes.test.ts` — HTTP contract and error mapping
- `apps/mobile/src/__tests__/hooks/useDares.test.ts` — loading, actions, paywall routing

## Not in this version

Per-dare chat. `dare_messages` exists and is wired into the schema, but a second inbox
split from the main match chat was cut in favour of status transitions plus the sender's
note. Photo proof, random-dare, and streaks remain unbuilt.
