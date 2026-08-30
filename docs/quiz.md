# Couples quiz

Maintained reference for the shareable "how well do you know each other?"
quiz: a couple works through the same set of questions, each partner answers
about themselves and guesses about the other, and the pair only sees a score
once both have finished.

## Ownership

| Concern | Location |
|---|---|
| Schema and seed content | `apps/api/drizzle/0019_quiz.sql` |
| HTTP contract | `apps/api/src/domains/quiz/routes.ts` |
| Session and scoring rules | `apps/api/src/domains/quiz/repository.ts` |
| Pure scoring function | `apps/api/src/domains/quiz/service.ts` (`computeQuizScore`) |

## Session lifecycle

```
POST /v1/quiz/sessions ──► active session (10 questions, question order fixed at creation)
   │
   ├── each partner submits a full answer set (self + guess per question)
   │
   └── once BOTH partners have a complete set ──► session completes, score is computed
```

Only one active session exists per couple at a time (`quiz_sessions_one_active_per_couple_idx`,
a partial unique index on `couple_id` where `status = 'active'`). Starting a
quiz while one is already active returns that same session (`200`) instead of
creating a second one; two simultaneous starts race safely because the
partial unique index, not application locking, is the source of truth.

Answers are submitted as one complete batch per call (`quiz_answers`, upsert
on `(session_id, user_id, question_id)`). A submission must cover every
question in the session exactly once, with every index inside that
question's option list, or it is rejected with `400 invalid_answers`. A
session that has already completed rejects further submissions with
`409 session_completed`.

## Scoring

Each question contributes up to two hits: partner A's guess about B counts if
it matches B's self-answer, and separately B's guess about A counts if it
matches A's self-answer. `score_percent = round(100 * hits / (2 *
question_count))`. `computeQuizScore` in `service.ts` is the pure,
unit-tested implementation; the repository only assembles the per-question
pairs and persists the result.

## Couple isolation

Every session and result lookup is scoped to the caller's own couple. A
session ID that belongs to another couple returns `404 session_not_found`,
never a hint that it exists elsewhere. Starting a quiz requires both a couple
(`409 no_couple`) and a paired partner (`409 partner_required`).

## HTTP contract

| Method | Path | Notes |
|---|---|---|
| POST | `/v1/quiz/sessions` | `201` on a new session, `200` when an active one already exists |
| GET | `/v1/quiz/sessions/current` | `{ session: SessionPayload \| null }`, most recent session for the couple |
| POST | `/v1/quiz/sessions/:sessionId/answers` | `{ answers: [{ question_id, self_index, guess_index }] }` |
| GET | `/v1/quiz/sessions/:sessionId/result` | `409 session_not_completed` before both partners finish |

`SessionPayload` never includes the partner's raw answers before completion;
per-question partner detail (`partner_self_index`, `partner_guess_index`,
`partner_guessed_right`) is only exposed by the `/result` endpoint of a
completed session.

## Tests

- `apps/api/test/quiz.service.test.ts`: unit tests for `computeQuizScore`
- `apps/api/test/quiz.routes.test.ts`: HTTP contract and error mapping
- `apps/api/test/quiz.integration.test.ts`: real PostgreSQL, covering the full
  happy path with a hand-computed score, idempotent session start, couple
  isolation, incomplete answer set rejection, and result blocked before
  completion

## Mobile client

| Concern | Location |
|---|---|
| Feature screens, hooks, API client | `apps/mobile/src/features/quiz/` |
| Zustand store (generation-counter pattern, cleared on sign-out) | `apps/mobile/src/store/quizStore.ts` |
| Discovery entry point | `apps/mobile/src/components/discovery/QuizTile.tsx` |
| Route wrapper | `apps/mobile/app/(app)/quiz.tsx` |

The screen walks not-paired, intro, answering (one question at a time, self
then guess), waiting-on-partner, and results states off `useQuizScreen`.
Answers are held client-side per question until every question in the
session has both a self and a guess index, then submitted as the one batch
the API expects; the store never calls the answers endpoint more than once
per session. Results render a shareable card (`QuizResultsShareCard` /
`QuizShareModal`, following the `SharePreviewModal` capture pattern) carrying
only the match score and Sauci branding, never question text or answers, so a
screenshot cannot leak either partner's content.

## Not in this version

Question authoring tooling in the admin app is out of scope for this change.
