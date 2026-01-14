-- Add display_name column to contacts table
-- This allows contacts to have a different name shown on calendar/board
-- e.g., "Hannah" can display as "Mormor" on the calendar

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN contacts.display_name IS 'Name shown on calendar/board. If null, the regular name is used. Useful for showing relationship names like "Mormor" instead of real names.';
