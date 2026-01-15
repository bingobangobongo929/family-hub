-- Add is_background column to event_categories
-- Background events show in "This week" section instead of "Soon" in Schedule widget

ALTER TABLE event_categories
ADD COLUMN IF NOT EXISTS is_background BOOLEAN DEFAULT false;

-- Update default background categories
UPDATE event_categories
SET is_background = true
WHERE name IN ('Guest Daycare', 'School', 'Holiday/Vacation');
