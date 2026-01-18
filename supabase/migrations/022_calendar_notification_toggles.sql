-- Add separate toggles for calendar event notifications
-- calendar_event_created already exists, adding changed and deleted

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS calendar_event_changed BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS calendar_event_deleted BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN notification_preferences.calendar_event_changed IS 'Notify when a calendar event is edited';
COMMENT ON COLUMN notification_preferences.calendar_event_deleted IS 'Notify when a calendar event is deleted';
