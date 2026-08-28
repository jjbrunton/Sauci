# Hosted data-plane cutover

This runbook moves product data and private files from hosted Supabase to the
standalone PostgreSQL and filesystem backend. Supabase Auth remains hosted. The
tool never discovers credentials from project files: operators provide explicit
environment variables for each invocation.

## Safety contract

- Use Node 20.10/npm 10.2 and a freshly migrated target database.
- `SOURCE_DATABASE_URL` and `TARGET_DATABASE_URL` are mandatory and must name
  different physical databases. Query-string/search-path differences do not
  make one database safe as both source and target.
- Local target hosts are allowed by default. Every remote target hostname must
  appear exactly in `MIGRATION_TARGET_HOST_ALLOWLIST` (comma-separated).
- Storage credentials are required only with `--storage` and are never written
  to checkpoints or reports. Use a short-lived source service-role credential.
- `--prune` is accepted only with a non-dry-run `--final-sync`, after legacy
  product-data writes have been stopped. It deletes target rows absent at source.
- Checkpoint and report files contain IDs/counts but no connection strings. Keep
  `.migration-state/` out of source control.

## Tool behavior

`npm run migration:cutover -w @sauci/api -- ...` imports tables in foreign-key
order, preserves common IDs/timestamps, maps legacy-to-target schema differences
by explicit target-column intersection, and upserts on stable primary/business
keys. An initial interrupted run resumes from its atomic JSON checkpoint. A
`--final-sync` always replays every table, ignoring initial-run table checkpoints.
The manifest includes the complete supported legacy product and administrative
set: `couples`, `profiles`, `admin_users`, `master_keys`, `categories`,
`question_packs`, `topics`, `pack_topics`, `questions`, `app_config`,
`ai_config`, `dare_packs`, `dares`, `sent_dares`, `dare_messages`,
`couple_packs`, `responses`, `matches`, `couple_streaks`, `messages`,
`match_archives`, `message_deletions`, `message_reports`,
`notification_preferences`, `feedback`, `subscriptions`,
`revenuecat_webhook_events`, `redemption_codes`, `code_redemptions`,
`feature_interests`, `live_draw_sessions`, `catchup_reminder_tracking`, and
`audit_logs`. A missing source or target table is reported as skipped rather
than silently treated as copied.

Supported storage buckets are `avatars`, `response-media`, `chat-media`, and
`feedback-screenshots`. Objects are downloaded to `MEDIA_ROOT/<bucket>/<name>`
through temporary files and atomic renames. Unsafe paths are rejected. Imported
objects are registered in `media_objects`; object ID, owner, creation time, MIME
type, and byte size are retained. The checkpoint uses object update time and size
so retries do not redownload completed objects.

After each copied **or checkpoint-resumed** object, the importer rewrites legacy
object names, bucket paths, and Supabase public/signed URLs to the canonical
`media:<uuid>` reference. This covers `profiles.avatar_url`,
`messages.media_path`, `feedback.screenshot_url`, and
`responses.response_data.media_path`. Treat any remaining legacy storage URL in
those fields as a failed migration even when file counts match.

Every run writes a JSON report with source/target row counts, copied/skipped/file
counts, target files missing or size-mismatched on disk, and relational checks for
orphaned profiles, responses, matches, messages, and couple mismatches. A final
sync with failed parity exits with status 2.

## Rehearsal and initial copy

1. Create a disposable target from migrations `0000` onward. Back up both target
   PostgreSQL and its media volume before every rehearsal.
2. Export credentials into the process environment without echoing or sourcing a
   broad application `.env`:

   ```sh
   export SOURCE_DATABASE_URL='postgresql://.../source'
   export TARGET_DATABASE_URL='postgresql://.../target'
   export MIGRATION_TARGET_HOST_ALLOWLIST='staging-db.internal'
   export MIGRATION_CHECKPOINT_FILE='/secure/state/sauci-initial.json'
   export MIGRATION_REPORT_FILE='/secure/state/sauci-initial-report.json'
   ```

3. Inspect the read-only plan:

   ```sh
   npm run migration:cutover -w @sauci/api -- --dry-run
   ```

4. Run the database copy. To include storage, additionally set `MEDIA_ROOT`,
   `SOURCE_STORAGE_URL`, and `SOURCE_STORAGE_SERVICE_ROLE_KEY`, then add
   `--storage`:

   ```sh
   npm run migration:cutover -w @sauci/api -- --storage
   ```

5. Review the report. Differences are permitted during the initial live copy but
   every relational check must be zero. Check the four media-reference fields for
   legacy URLs/paths. Exercise authenticated mobile flows against staging:
   profile/couple, packs, swipe/response/match/streak, chat and media
   upload/download, settings, feedback, billing refresh, and deletion. Use only
   an isolated hosted non-production Auth project and a disposable test identity
   mapped to a staging profile; never use the production subscriber as an E2E
   fixture.

## Stopped-source final sync and cutover

1. Announce maintenance and stop every legacy product-data writer: mobile/API
   traffic, Supabase Edge Functions, webhooks, cron jobs, and administrative
   writes. Supabase Auth may stay available. Record the stop time.
2. Confirm the source is quiescent by taking row/object counts twice several
   minutes apart. Do not proceed if they change.
3. Snapshot the standalone database and media volume. Retain the last successful
   initial report and checkpoint.
4. Use a new final checkpoint/report path and run exact reconciliation:

   ```sh
   npm run migration:cutover -w @sauci/api -- --final-sync --prune --storage
   ```

5. Require `parity: true`, identical row/file counts, zero failed/missing files,
   zero legacy media references, and zero relational violations. Independently
   query high-value counts and test two-user couple isolation and application
   behavior.
6. Switch the API/mobile data endpoint, keeping the source data plane read-only.
   Monitor API errors, authentication, database saturation, media reads, queues,
   webhooks, and the first real subscriber flow.

## Rollback

Rollback is routing, not reverse synchronization. If post-cutover acceptance
fails, stop writes to the standalone backend, capture its database/media snapshot
and logs, route clients back to the still-retained legacy data plane, and re-enable
legacy writers in their dependency order. Data created only after cutover must be
reconciled explicitly before reopening writes; never blindly import it backwards.

Do not delete hosted tables/buckets or downgrade Supabase until the agreed
observation window has passed, backups have been restore-tested, and rollback is
formally closed. Only then remove product-data functions/storage and return the
hosted project to its Auth-only footprint.
