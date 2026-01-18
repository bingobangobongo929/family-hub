-- Add option to receive notifications about your own calendar changes
-- By default TRUE - users always see all changes to the family calendar

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS calendar_notify_own_changes BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN notification_preferences.calendar_notify_own_changes IS 'Also notify me about calendar changes I make myself (for confirmation/audit)';

-- Also enable 1-day reminders by default for better UX
-- (Only affects new rows, existing users keep their settings)
ALTER TABLE notification_preferences
  ALTER COLUMN calendar_reminder_1d SET DEFAULT TRUE;
