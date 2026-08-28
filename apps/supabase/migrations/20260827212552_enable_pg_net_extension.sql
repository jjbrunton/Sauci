-- Notification triggers and scheduled jobs call net.http_post.
-- Keep the extension in migrations so clean local and preview databases have
-- the same dependency as hosted environments.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
