# Sex and fun relationship market strategy

**Research date:** 2026-09-05
**Decision:** Position Sauci as a private mutual-discovery product for adult
couples, then make a mutual match an optional real-world action.

## Scope and evidence limits

This is product-direction research, not a legal opinion, store-submission
assessment, competitor content scrape, or paid-subscription teardown. It uses
public product pages and store metadata, a public filing, official platform
policies, and a small number of public Reddit discussions. Reddit is anecdotal,
may include self-promotion, and is useful for hypotheses rather than market
sizing or claims about a gated catalogue.

Desire publicly advertises a paid "Chili" level and hotter challenges. This
research did not verify the prompts in that tier, so a claim that it contains
policy-breaking material is unsupported.

The repository's universal catalogue safety document is a plan, not proof that
all current question recommendation and pack APIs enforce `content_status`.
Current dare catalogue and send paths do enforce reviewed content. Universal
question enforcement remains future work described by the
[catalogue safety plan](catalog-content-safety-plan.md).

## Market map

| Segment and representative | Publicly visible proposition | Strategic read | Sauci opportunity |
| --- | --- | --- | --- |
| Relationship wellness: Paired, Agape, Couply | Daily questions, guided connection, habits, and quizzes. | Can feel like maintenance or therapy. | Keep emotional safety, but make the output a shared possibility. |
| Progressive couples game: Desire | Points, dares, categories, paid access, and a "Chili" level. | The paid progression model is visible. The risk of uneven participation is a hypothesis drawn from anecdotal reports. | Test mutual interest first; retain editable, optional follow-on action. |
| Explicit single-device sex games | Position, dice, foreplay, truth-or-dare, and challenge catalogues on one device. | Direct novelty but generic couple context and a higher policy burden. | Own two-person discovery and communication, not a graphic instruction catalogue. |
| Former Official | Public reports describe private mutual selection of date and intimacy ideas. Bumble later closed it within portfolio changes. | Mutual discovery is a product hypothesis worth testing; closure does not establish that the mechanic failed. | Test private matching as the core promise, then provide a next action. |
| Sauci | Couple-isolated questions, reciprocal matches, chat, audio/photo responses, and dares exist. | The primitives exist but need a clearer journey and adult-content guardrails. | "Find something you both genuinely want to try, without either person having to risk a direct no." |

### External sources by evidence type

- **Developer marketing claims:** [Paired](https://www.paired.com/),
  [Agape](https://www.getdailyagape.com/), [Couply](https://www.couply.app/),
  and [Desire](https://www.desire.games/) describe their own products. They do
  not establish engagement or efficacy.
- **Store metadata:** [Desire on Google Play](https://play.google.com/store/apps/details?id=com.desireapps.desire)
  and [Desire on the App Store](https://apps.apple.com/us/app/desire-couples-game/id923073855)
  describe published availability, rating, and paid-tier language.
- **Public filing:** [Bumble's 2024 annual report](https://s202.q4cdn.com/372973788/files/doc_financials/2024/q4/BMBL-10K-Q4-2024.pdf)
  records Official's closure in the context of portfolio changes.
- **Anecdotal Reddit evidence:** [Desire and Spicer discussion](https://www.reddit.com/r/DeadBedrooms/comments/1q7gb6h/desire_couples_game_app_or_spicer_app_seeking/)
  and [couples-app discussion](https://www.reddit.com/r/apps/comments/1qao3tr/any_good_couples_apps_youd_recommend/)
  contain first-hand opinions, but are small and unrepresentative.

### Store metadata snapshot

The following Google Play figures were captured during this research on
2026-09-05. They are store metadata, not independently audited market share,
and can change at any time. No pricing is inferred.

| App | Google Play installs | Rating | Reviews | Use in this strategy |
| --- | ---: | ---: | ---: | --- |
| Desire | 1M+ | 4.4 | 20.9K | Progressive couples game reference. |
| Paired | 1M+ | 4.6 | 63.3K | Relationship-wellness reference. |
| Agape | 500K+ | 4.1 | 9.55K | Relationship-wellness reference. |
| Couply | 100K+ | 4.4 | 1.95K | Relationship-wellness reference. |
| Lovify | 1M+ | 4.7 | 21.7K | Adjacent couples-app reference. |

Store pages: [Desire](https://play.google.com/store/apps/details?id=com.desireapps.desire),
[Paired](https://play.google.com/store/apps/details?id=com.getpaired.app),
[Agape](https://play.google.com/store/apps/details?id=com.getdailyagape),
[Couply](https://play.google.com/store/apps/details?id=io.couply.android), and
[Lovify](https://play.google.com/store/apps/details?id=com.mindsets.lovify). Explicit
Apple-only game entries remain qualitative because comparable Play install
metadata is unavailable.

## Target customer

The primary customer is an adult couple with a viable relationship who wants
more novelty, flirtation, or intimacy, but finds direct initiation of an
unfamiliar idea awkward. They need privacy around an unmatched interest, control
over intensity, and a route from curiosity to a mutually chosen action.

Initial exclusions are couples seeking clinical repair or coercion intervention,
a solitary-arousal or explicit-instruction catalogue, a product that assigns
sexual tasks from one partner to the other, and all minor or adult/minor use.
This is scope control, not a judgment about those users.

## Current technical foundation

| Existing foundation | Exact repository evidence | Product use |
| --- | --- | --- |
| Swipe, text answer, audio, photo, and who-likely questions | [Question interaction contract](../question-types.md), [shared type](../../packages/shared/src/types/index.ts) | Private preference selection, written invitations, voice-led prompts, and playful questions. |
| Reciprocal match semantics and response summaries | [Question interaction contract](../question-types.md), [match calculation](../../apps/api/src/domains/answers/types.ts) | Reveal only a mutual interest or both-partner response. |
| Sender-to-recipient dares with decline, cancel, expiry, and audio/photo proof | [Dares loop](../dares-loop.md), [dare repository](../../apps/api/src/domains/dares/repository.ts) | Existing optional challenge flow, not a shared-action model. |
| Couple-shared premium entitlement | [Dares entitlement](../dares-loop.md), [subscription system](../subscription-system.md) | Offer a shared upgrade without paywalling a received invite. |
| Dare push payloads and reviewed-dare gating | [Dares safety rules](../dares-loop.md) | Keep dare text out of notification previews and unreviewed dares out of clients. |
| JavaScript and asset OTA delivery | [Mobile OTA policy](../mobile-ota.md) | Ship compatible client UI, copy, logic, and assets without a new binary. |

The [catalogue safety plan](catalog-content-safety-plan.md) defines the intended
developer-authored content ceiling: no sexual acts, instructions, fetish content,
or material intended for sexual gratification. It states that age confirmation,
intensity, premium access, and hidden categories must not override that ceiling.
It is future universal question/pack enforcement work. Do not describe it as
currently enforced for question recommendation or pack APIs.

## Product positioning and architecture

> Sauci helps couples turn unspoken curiosity into things they both want to try.

Lead with mutuality, privacy, and choice, not content count, coins, or a promise
of explicit material. Organise approved content by desired outcome: flirt and
anticipate; touch and sensation; take the lead; give up control; tell me
privately; try something new; fantasy without assumption; setting and
atmosphere; playful roles; long-distance desire; boundaries and comfort;
aftercare and reconnection; create your own; and matches for later.

Developer-authored wording should remain non-graphic and choice-based.
Couple-authored detail is UGC, not a policy workaround. The proposed product
rule is that new content remains unreviewed and ineligible until a recorded
editorial decision allows it; universal question/pack enforcement is not yet
current behaviour.

```text
Choose a mood and shared comfort ceiling
  -> privately answer a short set
  -> reveal only a mutual interest or both-partner response
  -> talk, save, or create an optional dare
  -> complete, defer, decline, or withdraw without penalty
```

Do not disclose which partner chose the lower comfort ceiling. This is a desired
future product rule, not an existing session contract. Today the system has a
persistent `max_intensity` preference and global selection gates; it does not
have a per-session shared comfort record or a mutual private-ceiling protocol.
Likewise, a distinct defer, softer alternative, or withdrawal state needs a
domain contract rather than a client label alone.

## One-week delivery plan

**Current OTA blocker:** the maintained [OTA policy](../mobile-ota.md) says a
new store bootstrap build is required before updates can flow. Consequently none
of these changes can currently reach users by OTA. After that bootstrap build,
client-only prototyping may be OTA-compatible when it stays within the installed
native surface. The policy still requires a new store build for native code,
dependencies, native configuration, or generated iOS/Android changes.

Server-side catalogue/configuration activity is separate operational work, not
an OTA bundle.

| Priority | Change | OTA UI/client work | Server-side data/config | Boundary |
| --- | --- | --- | --- | --- |
| 1 | Quick Spark prototype | Mood entry, 5-8 card session, completion, and mutuality explainer. | Curate only currently eligible question inventory after its enforcement status is verified. | Client prototype may be OTA-compatible after bootstrap; proper reviewed-question enforcement is future API work. |
| 2 | Match-to-shared-action design | Add a non-committing Talk or Save affordance. | Design a match-linked shared-action domain model. | True shared action is API/domain work. Current dares assign a sender and recipient. |
| 3 | Shared comfort design | Prototype explanatory UI only. | Persist a per-session private selection and calculate a shared ceiling server-side. | Backend/data work. Current `max_intensity` and global gates are not a session protocol. |
| 4 | Tell Me Privately prototype | Curate text/audio presentation with both-partner reveal copy. | Verify question eligibility and review any activated prompts. | Client work may be OTA-compatible after bootstrap; no claim of new enforcement. |
| 5 | Defer and withdrawal design | Improve wording only where existing decline/cancel actions remain truthful. | Add distinct defer, softer alternative, and withdrawal states with no-penalty semantics. | Backend/data work, not an OTA-only change. |

Do not call a change OTA-deliverable until the bootstrap build has shipped and
the final diff stays inside the installed native surface. Catalogue activation
needs its own review, staged rollout, and rollback plan.

## Store-policy and UGC boundary

Google Play prohibits content intended to be sexually gratifying and identifies
explicit sexual text and sex guides among common violation types. Apple
prohibits overtly sexual or pornographic material. Use the stricter Google
ceiling for one cross-platform developer-authored catalogue.

- [Google Play sexual content policy](https://support.google.com/googleplay/android-developer/answer/9878810)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937)

Subscription, an 18+ label, intensity setting, content flag, or private screen
is not a policy exception. Paid functionality must be compliant and reviewable.

Text, audio, photo, custom dare, and chat create UGC exposure. Before expanding
adult-oriented user-authored interactions, verify effective reporting and
blocking, terms and enforcement, moderation operations, rate limits, safe push
previews, and an incident route for non-consensual or illegal content. The
catalogue safety plan requires these controls for user-authored fields; their
actual implementation status must be checked before marketing relies on them.

## Gaps and measurement

Before a broader adult-content launch: complete the universal question/pack
`content_status` enforcement specified by the catalogue plan; verify or
implement age assurance and accurate store ratings; add private session comfort
and durable interest/maybe/boundary states; make withdrawal, deferral, and
softer alternatives explicit in a shared-action contract; verify moderation for
every UGC surface; and establish reviewed editorial audit for every
developer-authored prompt, pack, and dare.

Measure aggregate, privacy-preserving events only. Do not collect prompt text,
response text, audio, photo content, or intimate match detail in analytics.

| Funnel stage | Measure | Decision |
| --- | --- | --- |
| Entry | Starts by mood and shared ceiling | Which framing gets couples into the loop. |
| Participation | Both-partner completion and time to second response | Whether the mode gets reciprocal participation. |
| Mutuality | Match rate by reviewed content group and intensity | Whether selection is calibrated. |
| Action | Match-to-talk, save, dare-draft, send, and completion rates | Whether discovery creates a wanted next step. |
| Safety | Skip, defer, decline, cancel, report, and block rates without content payloads | Whether a category creates pressure or risk. |
| Retention | Another short session within 7 and 28 days | Whether the loop survives novelty. |

Do not optimise only for sends or completions. High decline, report, or
withdrawal is a safety signal, not a conversion problem to suppress.

## Decision gates

1. Approve the positioning and mutual-match-to-optional-action hypothesis.
2. Ship and verify the required OTA bootstrap store build before treating any
   client change as OTA deployable.
3. Split shared action, session comfort, and durable consent states into API and
   data work rather than representing them as client-only changes.
4. Audit age assurance and UGC safeguards before marketing adult-oriented
   custom media or prompts.
5. Complete universal question/pack review enforcement before activating new
   adult-oriented developer-authored catalogue content.
