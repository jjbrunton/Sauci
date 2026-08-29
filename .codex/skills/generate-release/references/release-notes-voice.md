# Sauci release-note voice

Sauci sounds warm, confident, inviting, and quietly playful. It is a premium
couples app about private connection and shared curiosity: supportive without
being clinical, polished without sounding corporate, and intimate without being
graphic or presumptuous.

## Shape

Use a short opening sentence followed by three to six compact bullets. Lead with
the change that most improves a couple's experience. Combine related work into
one benefit rather than mirroring the commit list. Include a brief closing line
only when it adds warmth or useful context.

In `docs/release-notes.md`, use:

```markdown
## v1.2.3 — 29 August 2026
_iOS build 44 · Android build 48_

A little more ease, clarity, and connection in every check-in.

- **Closer conversations** — Find the prompts that feel right for both of you.
- **Smoother moments** — Chats and matches now feel quicker and more reliable.
- **More control** — Clearer choices help keep your shared space comfortable.
```

Adapt the words to the evidence; do not reuse this copy when those claims are not
present in the release. If only one platform was requested, record only its build.

## Language

- Address the couple's experience with `you`, `your partner`, `together`, or
  `your shared space` where natural.
- Prefer concrete benefits: `pick up where you left off`, `find the right prompt`,
  `keep conversations flowing`, `stay in control`.
- Use restrained warmth. One gentle phrase is enough; avoid forced innuendo,
  breathless hype, exclamation marks, emoji, and claims that Sauci will improve or
  fix a relationship.
- Prefer `new`, `smoother`, `clearer`, `more private`, and `more reliable` to
  `revolutionary`, `game-changing`, `massive`, or `best ever`.
- Explain a fix as the experience restored, not the defect mechanics. Name a
  security or privacy change plainly when users need to understand it.

## Evidence boundary

Release notes describe shipped behavior only. Do not claim a feature from a plan,
flagged-off path, migration, test, or commit title without confirming the runtime
path in the diff and release configuration. Do not expose internal service names,
database details, moderation logic, security-sensitive implementation, or content
that the product intentionally keeps private between partners.
