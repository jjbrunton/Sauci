# Couple streaks

A streak counts consecutive days on which **both** partners answered at least one
question. It is deliberately a property of the couple, not of a person: there is no
individual streak anywhere in the product, and there is not meant to be one.

## What counts as a day together

A day counts when both partners record a response to any eligible question on the same
couple-local calendar date. It is **not** tied to one specific question.

This is a product decision, not an implementation shortcut. Tying the streak to a single
daily question would break a couple who answered fifteen other questions and missed that
one, which is exactly the kind of arbitrary loss that makes the mechanic feel punitive. If
a daily question ships, it should be the prompt that reliably produces the answer, not the
only answer that counts.

Answering more than once in a day does nothing extra. Catch-up answers count the same as
new exploration; they are already exempt from the daily response cap.

## The day boundary

The streak day is the **couple's shared local day**. Both partners have to land inside the
same calendar date, so the day boundary cannot belong to whoever happens to be answering.

The zone is the first reported `profiles.timezone` in member id order — the same ordering
that decides the `user1`/`user2` columns — falling back to the other partner's zone, then
to UTC when neither has reported one or the reported zone is not a known IANA name.

Counting in UTC instead would break a couple in a western zone at UTC midnight while it is
still the same evening where they live. Partners in different zones share one boundary
rather than each getting their own, because the day either happened for the couple or it
did not.

## Storage and writes

`couple_streaks` holds one row per couple:

| Column | Meaning |
|---|---|
| `current_streak` | Consecutive completed days. |
| `longest_streak` | High-water mark, never reduced. |
| `last_active_date` | Couple-local date either partner last answered. |
| `last_completed_date` | Couple-local date **both** partners last answered. |
| `user1_answered_today` / `user2_answered_today` | Per-partner flags for `last_active_date`, positional by member id. |
| `streak_celebrated_at` | Highest milestone already notified. |

`PostgresAnswersRepository.touchStreak` maintains the row inside the same transaction as
the response that caused it, so the streak can never disagree with the responses it counts.
There is no trigger and no cron reset: the write path treats the flags as stale whenever
`last_active_date` is not the couple-local today, which makes a separate midnight job
unnecessary and removes a whole class of clock-skew bugs.

The streak is alive while `last_completed_date` is the couple-local today or yesterday.

## Reading

`GET /v1/me/streak` resolves the row from the **caller's** point of view and returns
`you_answered_today`, `partner_answered_today`, and `partner_name`. The stored flags are
positional because the writer has to be deterministic, but a client cannot act on
"user2 has not answered" without re-deriving the id ordering, so the API does it instead.

The read applies the same day rules as the write. A lapsed streak reports
`current_streak: 0` immediately rather than showing its stored number until the next
response silently resets it, and stale per-partner flags read as `false`.

## Notifications

Two producers in `PostgresOperationsRepository`, both queued through the outbox with a
dedupe key and both individually opt-out-able:

| Producer | Fires | Preference |
|---|---|---|
| Milestones | On reaching 7, 14, 30, 60, or 100 days, once per milestone per couple. | `streak_milestones_enabled` |
| At-risk nudge | From 20:00 couple-local, when the streak is alive and the day is incomplete. Only the partner who still owes an answer is notified. | `streak_reminders_enabled` |

The at-risk copy names the partner who has already answered as an invitation
("Alex answered today"), never as a debt. Guilt between partners is the failure mode for a
shared streak, not the goal — the original implementation reset broken streaks silently for
the same reason, and that should stay true of anything added here.

## Surfaces

- Discovery screen: full card, hidden entirely for couples with no live streak and no
  activity today, so a dormant pair is never shown a zero.
- Swipe header: compact flame and count.
- Profile settings: both notification toggles, shown only once the user has a partner.

## Legacy data plane

The retired Supabase project scheduled `reset-daily-streak-flags` and
`check-streak-milestones` cron jobs and a `check-streak-milestones` Edge Function against
the old `couple_streaks` table. The API owns both jobs now. Those legacy writers are
stopped as part of the cutover procedure in
[backend deployment and branching](operations/backend-deployments.md); if any hosted
project still has them scheduled, an operator unschedules them directly — agents do not
execute remote DDL. Migration `0016_couple_streak_locality.sql` drops the equivalent
trigger and functions from the product database defensively.
