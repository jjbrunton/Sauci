# Client data freshness

The mobile app talks to a request-per-read API with no realtime channel. This
document is the contract for how it stays current without spending a request
every time the user looks at something they have already loaded.

## The invariant

**Cached data is usable data.** Once a screen has loaded, switching away from it
and back must cost zero requests and must never blank what is on screen. A
refresh happens for a reason — the user pulled to refresh, a mutation invalidated
the data, or a change marker moved — never merely because a screen regained
focus.

Three rules make that hold:

- **Loaded-ness is recorded, not inferred.** Stores keep a marker
  (`loadedAt`, `catalogLoadedAt`, `enabledPacksLoadedAt`) that is set on a
  successful load and cleared on sign-out or explicit invalidation. Emptiness is
  a legitimate answer, not evidence of never having loaded: keying off
  `array.length === 0` makes every visit to an empty list pay for the same empty
  response.
- **Initial loading and refreshing are different states.** `isLoading` means
  there is nothing to show yet and drives the full-screen loader. `isRefreshing`
  drives pull-to-refresh only. A background refresh raises neither, so cached
  rows stay on screen and in place until the replacement arrives.
- **Invalidation is free.** A mutation that changes another screen's data marks
  that cache stale (`invalidatePacks`, `invalidateResponses`) instead of
  refetching it. Whichever screen the user opens next reloads once; screens they
  do not open stay quiet.

Overlap protection lives in a module-scoped `inFlight` set rather than in the
loading flags, because a silent refresh raises no flag and still must not issue a
second request. The set is cleared alongside the store on sign-out, so a
signed-out user's in-flight request cannot suppress the next user's.

## Recurring work

`usePolling` (`apps/mobile/src/hooks/usePolling.ts`) owns every recurring read.
It schedules the next run after the previous one settles rather than on a fixed
interval, so a slow response delays the next request instead of queueing one
behind it, and it provides three properties no hand-rolled interval in this app
had:

- it stops while the app is backgrounded or `inactive`, and catches up
  immediately on return;
- it never runs two passes concurrently;
- it backs off exponentially — to `maxIntervalMs`, eight intervals by default —
  while the API is failing.

Callers gate it further with `enabled`, which carries screen focus, a loaded id,
or a paired couple. Screens pass focus in as a prop rather than having the hook
read navigation state, so hooks stay renderable without a navigator.

| Poller | Interval | Runs while |
|---|---|---|
| Couple sync (`useCoupleSync`) | 15s | signed in, app foregrounded |
| Chat messages | 2s | chat screen focused |
| Dares | 5s | dares screen focused |
| Live draw | 750ms | canvas focused |

Live draw keeps the sub-second cadence a shared canvas needs, but only for the
seconds someone is actually looking at it.

## `GET /v1/me/sync`

One small query summarising everything the app used to discover by re-reading
five endpoints. The client compares it against the previous summary and refreshes
only the domains whose markers moved — and only those already loaded, so a view
nobody has opened is never fetched in the background.

| Field | Moves when |
|---|---|
| `server_time` | every call |
| `couple_id`, `profile_updated_at` | the user's own profile or couple membership changed |
| `partner_id`, `partner_updated_at` | the partner's profile changed |
| `match_count`, `new_match_count`, `latest_match_at` | matches were created, seen, or archived |
| `pending_yours`, `pending_theirs` | either side answered a question the other is waiting on |
| `unread_total` | chat unread count for this user changed |
| `enabled_packs_fingerprint` | the couple's enabled pack set changed |
| `match_state_fingerprint` | a visible match's type or response summary changed in place |
| `match_unread_fingerprint` | unread moved between matches, with or without a change to the total |
| `streak_updated_at` | the couple's streak row changed |

`unread_total` is applied directly to the badge, so keeping it current costs
nothing beyond this request. The first poll after sign-in only establishes the
baseline: every screen loads its own data on mount, and refreshing it again would
undo the saving.

`enabled_packs_fingerprint` is an `md5` digest of the enabled pack ids rather
than a timestamp, because `couple_packs` carries no `updated_at` and equal and
opposite toggles would otherwise be invisible. Zero enabled packs is the stable
digest of the empty string, not `null`.

The two match digests exist for the same reason in a different shape: the counts
and `latest_match_at` all hold steady when a partner edits an existing match in
place, and `unread_total` holds steady when unread merely moves between matches —
which still reorders an unread-first list.

Every field is derived for the calling identity's own couple. The summary reveals
nothing about any other couple, and reveals no partner content — only that
something moved.

## Chat deltas

`GET /v1/matches/:id/messages` takes two optional parameters:

- `since` — an ISO 8601 timestamp with offset. Returns only rows whose visible
  state moved since then: created, delivered, read, deleted, media viewed, or a
  video whose `media_expires_at` fell inside the window. Messages are not
  editable, so there is no edit to report. A malformed value is rejected with
  `400 invalid_since` rather than silently treated as a full read.
- `typing=true` — folds the partner's typing state into the same response, so a
  focused chat makes one request per pass instead of two.

The response is a `MessagesPage`:

| Field | Meaning |
|---|---|
| `messages` | rows to merge by id, newest first |
| `removed_ids` | rows the client must drop (deleted, or deleted-for-self) |
| `server_time` | cursor for the next `since` |
| `complete` | true when this is a full snapshot rather than a delta |
| `typing` | present only when `typing=true` was requested |

`server_time` is deliberately set two seconds behind `now()` so a row committed
during the request cannot fall between two cursors. The overlap re-returns a
handful of already-known rows, which is harmless because the client merges by id.

`media_expired` is derived in the query — `media_expired or media_expires_at <=
now()` — rather than read from the stored column, which nothing ever writes. That
is the rule the media endpoint already applies when it refuses an expired object,
so a client is no longer handed a video it will not be allowed to fetch. Expiry is
also the one visible change no row write announces, which is why the delta
compares the deadline against the poll window rather than looking for a timestamp
that moved; the row is emitted in the single window its deadline falls into.

`moderation_status`, `flag_reason` and `category` are returned in full but are
**not** covered by `since`: the classifier and the admin tool rewrite them without
advancing any timestamp, so a delta cannot see them move. No client renders them
today, so nothing user-visible goes stale — but a client that started rendering
them would need a cursor for them, which means a new column on `messages`.

Deltas do not change access control, ordering, media fields, or deletion
semantics: a delta returns exactly the rows a full read would have returned for
that window, and a caller outside the couple still gets `match_not_found`.

The client marks the conversation read only when a response actually contains an
unread partner message, and `POST .../read` returns the number of rows it
cleared, so the badge is adjusted by subtraction rather than by re-reading the
total.

## Match pagination

`GET /v1/matches` returns `{ matches, totalCount, hasMore }`.

`totalCount` is a `number` on page 0 and **`null` on every later page**: the
count is a full scan of the couple's matches and nothing in the UI needs it more
than once per refresh. Clients keep the value from the refresh that started the
sequence.

`hasMore` comes from reading `limit + 1` rows and reporting whether the extra one
existed, so an exactly-full final page reports `false` correctly. Unread counts
are aggregated once in a CTE rather than by a correlated subquery per row.
Ordering (unread first, then newest) and couple isolation are unchanged.

Pagination itself is still page-number/`OFFSET`-based, not cursor-based. This
pass removed the repeated `count(*)` and the per-row unread subquery — the two
costs that scaled with the couple's history — but paging deep into a large
history still pays an `OFFSET` scan. Cursor pagination would remove that too;
it has not been implemented.

## `GET /v1/me` is idempotent

Bootstrapping a profile reads first and writes only what actually differs. An
unchanged read leaves both `updated_at` and `auth_synced_at` alone, so a client
polling `/v1/me` no longer produces a write per call. First use still creates
the profile from the auth identity's name, avatar and email. On every later
call only a changed **email** writes through, syncing the one field the auth
provider is authoritative for; the product's display name and avatar are not
touched, so a locally-edited name or avatar is never overwritten by
potentially stale auth metadata.

## One database pool

The API process creates a single `pg` pool and passes it to every repository, so
the process holds one bounded set of server connections rather than a
default-sized pool per domain. Shutdown ends that pool once. Repositories still
accept a connection string in tests, in which case they own and end the pool they
created — see `resolvePool` / `closeResolvedPool` in `apps/api/src/db/pool.ts`.

Bounds come from `DATABASE_POOL_MAX` (default 10),
`DATABASE_POOL_IDLE_TIMEOUT_MS` (30000) and
`DATABASE_POOL_CONNECTION_TIMEOUT_MS` (10000). They are process-wide; keep the
total across running instances inside the database's own connection limit.
