-- Notification System Migration
-- Adds comprehensive notification preferences and tracking

-- ============================================
-- NOTIFICATION PREFERENCES
-- ============================================
-- Stores user preferences for each notification type
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Calendar notifications
  calendar_enabled BOOLEAN DEFAULT TRUE,
  calendar_reminder_15m BOOLEAN DEFAULT TRUE,
  calendar_reminder_30m BOOLEAN DEFAULT FALSE,
  calendar_reminder_1h BOOLEAN DEFAULT TRUE,
  calendar_reminder_1d BOOLEAN DEFAULT FALSE,
  calendar_daily_agenda BOOLEAN DEFAULT TRUE,
  calendar_event_created BOOLEAN DEFAULT TRUE,
  calendar_event_changed BOOLEAN DEFAULT TRUE,

  -- Routine notifications
  routines_enabled BOOLEAN DEFAULT TRUE,
  routine_start_reminder BOOLEAN DEFAULT TRUE,
  routine_completion BOOLEAN DEFAULT TRUE,
  streak_milestones BOOLEAN DEFAULT TRUE,

  -- Task/Chore notifications
  tasks_enabled BOOLEAN DEFAULT TRUE,
  task_reminder BOOLEAN DEFAULT TRUE,
  task_overdue BOOLEAN DEFAULT TRUE,

  -- Shopping notifications
  shopping_enabled BOOLEAN DEFAULT FALSE,
  shopping_item_added BOOLEAN DEFAULT FALSE,

  -- Family notifications
  family_enabled BOOLEAN DEFAULT TRUE,
  birthday_reminder BOOLEAN DEFAULT TRUE,
  points_milestone BOOLEAN DEFAULT TRUE,

  -- Bin notifications
  bins_enabled BOOLEAN DEFAULT TRUE,
  bin_reminder_evening BOOLEAN DEFAULT TRUE,
  bin_reminder_morning BOOLEAN DEFAULT FALSE,

  -- F1 notifications
  f1_enabled BOOLEAN DEFAULT TRUE,
  f1_favorite_driver TEXT, -- driver ID e.g., 'verstappen'
  f1_favorite_team TEXT, -- constructor ID e.g., 'red_bull'
  f1_spoiler_free BOOLEAN DEFAULT FALSE,

  -- F1 Session reminders
  f1_race_reminder_15m BOOLEAN DEFAULT TRUE,
  f1_race_reminder_1h BOOLEAN DEFAULT TRUE,
  f1_race_reminder_1d BOOLEAN DEFAULT FALSE,
  f1_quali_reminder BOOLEAN DEFAULT TRUE,
  f1_sprint_reminder BOOLEAN DEFAULT TRUE,
  f1_practice_reminder BOOLEAN DEFAULT FALSE,

  -- F1 Results
  f1_race_results BOOLEAN DEFAULT TRUE,
  f1_quali_results BOOLEAN DEFAULT TRUE,
  f1_championship_updates BOOLEAN DEFAULT TRUE,

  -- F1 News
  f1_news_enabled BOOLEAN DEFAULT TRUE,
  f1_news_race_category BOOLEAN DEFAULT TRUE,
  f1_news_driver_category BOOLEAN DEFAULT TRUE,
  f1_news_technical_category BOOLEAN DEFAULT FALSE,
  f1_news_calendar_category BOOLEAN DEFAULT TRUE,

  -- F1 Favorite driver alerts
  f1_favorite_podium BOOLEAN DEFAULT TRUE,
  f1_favorite_win BOOLEAN DEFAULT TRUE,
  f1_favorite_pole BOOLEAN DEFAULT TRUE,

  -- System
  daily_digest BOOLEAN DEFAULT FALSE,
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '07:00',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- RLS for notification_preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- F1 NOTIFICATION STATE
-- ============================================
-- Tracks what F1 notifications have been sent to avoid duplicates
CREATE TABLE IF NOT EXISTS f1_notification_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Last notified article ID (for news)
  last_news_article_id UUID,
  last_news_check TIMESTAMPTZ,

  -- Last session reminded (to avoid duplicate reminders)
  last_session_reminded_key INTEGER, -- OpenF1 session_key
  last_session_reminded_at TIMESTAMPTZ,

  -- Last race results notified
  last_race_results_meeting_key INTEGER,
  last_quali_results_meeting_key INTEGER,
  last_sprint_results_meeting_key INTEGER,

  -- Championship state (to detect changes)
  last_drivers_leader TEXT,
  last_constructors_leader TEXT,
  last_standings_check TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- RLS for f1_notification_state
ALTER TABLE f1_notification_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own f1 notification state"
  ON f1_notification_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage f1 notification state"
  ON f1_notification_state FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- NOTIFICATION LOG
-- ============================================
-- Tracks all sent notifications for history/debugging
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  category TEXT NOT NULL, -- 'calendar', 'f1', 'routine', 'bin', etc.
  notification_type TEXT NOT NULL, -- 'race_reminder', 'news', etc.
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB, -- Additional payload

  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'delivered', 'read')),
  error_message TEXT,

  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notification_log_user_sent
  ON notification_log(user_id, sent_at DESC);

-- RLS for notification_log
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification log"
  ON notification_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notification log"
  ON notification_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- CALENDAR EVENT REMINDER TRACKING
-- ============================================
-- Enhanced reminder tracking for multiple reminder times
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS reminder_15m_sent TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_30m_sent TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_1h_sent TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_1d_sent TIMESTAMPTZ;

-- ============================================
-- ROUTINE REMINDER TRACKING
-- ============================================
ALTER TABLE routines
  ADD COLUMN IF NOT EXISTS last_reminder_sent TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN DEFAULT TRUE;

-- ============================================
-- HELPER FUNCTION: Get or create notification preferences
-- ============================================
CREATE OR REPLACE FUNCTION get_or_create_notification_preferences(p_user_id UUID)
RETURNS notification_preferences AS $$
DECLARE
  prefs notification_preferences;
BEGIN
  SELECT * INTO prefs FROM notification_preferences WHERE user_id = p_user_id;

  IF prefs IS NULL THEN
    INSERT INTO notification_preferences (user_id)
    VALUES (p_user_id)
    RETURNING * INTO prefs;
  END IF;

  RETURN prefs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE notification_preferences IS 'User preferences for all notification types';
COMMENT ON TABLE f1_notification_state IS 'Tracks F1 notification state to avoid duplicates';
COMMENT ON TABLE notification_log IS 'Log of all sent notifications';
