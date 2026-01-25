-- Add color column to categories table
-- Allows explicit color assignment; app falls back to name-based color logic if NULL

ALTER TABLE categories
ADD COLUMN color text;

COMMENT ON COLUMN categories.color IS 'Hex color code (e.g. #14B8A6) for category tiles. Falls back to app logic if NULL.';
