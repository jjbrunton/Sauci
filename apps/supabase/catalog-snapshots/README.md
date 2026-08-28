# Production catalogue snapshots

These files are immutable, version-controlled backups of Sauci's
developer-authored catalogue. They deliberately exclude subscriber accounts,
couples, responses, matches, messages, media, subscriptions, and other customer
data.

`production-2026-08-28.json` contains every production row from:

- `categories`
- `topics`
- `question_packs`
- `questions`, including soft-deleted rows and inverse links
- `dare_packs`
- `dares`
- `pack_topics`

The snapshot is archival input, not an automatically executed seed. Restoration
must be implemented as an explicit, reviewed operation that validates the target
environment, schema compatibility, foreign keys, row counts, and checksum before
writing anything.

Verify the checked-in snapshot from this directory with:

```sh
shasum -a 256 -c production-2026-08-28.sha256
```
