# Question interaction types

This is the maintained contract for the question interactions delivered through
the daily question flow. It is separate from the [couples quiz](quiz.md) and
[dares loop](dares-loop.md), which have their own content and completion
models.

<!-- question-types: swipe,text_answer,audio,photo,who_likely -->

## Supported types

| Type | User interaction | `response_data` and `config` | Match semantics |
| --- | --- | --- | --- |
| `swipe` | Choose yes or no, or skip. | No `response_data`; `config` is unused. | A no creates no match. The API also retains `maybe` matching for stored or replayed answers, producing `yes_maybe` or `maybe_maybe`; the current mobile card does not offer maybe. |
| `text_answer` | Write an answer and send it, decline with no, or skip. | `response_data`: `{ type: 'text_answer', text }`; `config` is unused. | Both partners must answer without a no. The match type is `both_answered`, with both payloads in `response_summary`. |
| `audio` | Record and send an audio answer, or skip. | `response_data`: `{ type: 'audio', media_path, duration_seconds }`; optional `config.max_duration_seconds` limits recording and defaults to 60 seconds in the admin UI. | Both partners must answer without a no. The match type is `both_answered`, with both payloads in `response_summary`. |
| `photo` | Take or select and send a photo answer, or skip. | `response_data`: `{ type: 'photo', media_path }`; `config` is unused. | Both partners must answer without a no. The match type is `both_answered`, with both payloads in `response_summary`. |
| `who_likely` | Choose which partner is more likely. The current mobile flow submits this as yes. | `response_data`: `{ type: 'who_likely', chosen_user_id }`; `config` is unused. | Once both partners respond, the match type is `both_answered`; the stored answer value does not gate that type's match calculation. Both choices are in `response_summary`. |

## Persistence and implementation ownership

`questions.question_type` defaults to `swipe`; the database check constraint and
the canonical shared `QuestionType` union must contain the same values.
`questions.config` is JSON configuration for a type. `responses.response_data`
stores an individual non-swipe payload. `matches.response_summary` is a JSON
object keyed by responder user ID and is populated for `both_answered` matches.

The canonical list is `QuestionType` in
[`packages/shared/src/types/index.ts`](../packages/shared/src/types/index.ts).
The database constraint is in
[`apps/api/drizzle/0003_answers_matches.sql`](../apps/api/drizzle/0003_answers_matches.sql).
Match calculation is in
[`apps/api/src/domains/answers/types.ts`](../apps/api/src/domains/answers/types.ts),
the mobile renderer is
[`apps/mobile/src/features/swipe/components/SwipeQuestionCard.tsx`](../apps/mobile/src/features/swipe/components/SwipeQuestionCard.tsx),
and admin authoring options are in
[`apps/admin/src/pages/content/QuestionsPage.tsx`](../apps/admin/src/pages/content/QuestionsPage.tsx).

## Change rule

When adding, removing, or changing a question type, its payload, configuration,
or matching semantics, update this document in the same change. Update the
shared type, database constraint, API, mobile, and admin consumers as required.
`npm run lint:harness` checks the documented type list against the canonical
shared union so an unreviewed list change fails routine verification.
