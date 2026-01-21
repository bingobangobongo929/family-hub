-- Add 'ai' as a valid source for calendar events
-- This allows events created via AI parsing from share extension

ALTER TABLE calendar_events DROP CONSTRAINT calendar_events_source_check;
ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_source_check
  CHECK (source IN ('manual', 'google', 'apple', 'outlook', 'ai'));
