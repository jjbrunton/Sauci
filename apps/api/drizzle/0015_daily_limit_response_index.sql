-- The daily response limit counts a user's responses within their current local day.
CREATE INDEX IF NOT EXISTS "responses_user_created_idx" ON "responses" ("user_id", "created_at" DESC);
