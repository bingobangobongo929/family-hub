-- Notification Preferences Complete Migration
-- Creates notification system tables if they don't exist
-- Adds all columns needed for the frontend component

-- ============================================
-- NOTIFICATION PREFERENCES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Master toggle
  master_enabled BOOLEAN DEFAULT TRUE,

  -- Calendar notifications
  calendar_enabled BOOLEAN DEFAULT TRUE,
  calendar_event_created BOOLEAN DEFAULT TRUE,
  calendar_reminder_15m BOOLEAN DEFAULT TRUE,
  calendar_reminder_30m BOOLEAN DEFAULT FALSE,
  calendar_reminder_1h BOOLEAN DEFAULT TRUE,
  calendar_reminder_1d BOOLEAN DEFAULT FALSE,

  -- Routine notifications
  routines_enabled BOOLEAN DEFAULT TRUE,
  routine_start_reminder BOOLEAN DEFAULT TRUE,

  -- Chore notifications
  chores_enabled BOOLEAN DEFAULT TRUE,
  chores_reminder BOOLEAN DEFAULT TRUE,

  -- Shopping notifications
  shopping_enabled BOOLEAN DEFAULT FALSE,
  shopping_list_changes BOOLEAN DEFAULT TRUE,

  -- Bin notifications
  bins_enabled BOOLEAN DEFAULT TRUE,
  bin_reminder_evening BOOLEAN DEFAULT TRUE,
  bin_reminder_morning BOOLEAN DEFAULT FALSE,

  -- F1 notifications
  f1_enabled BOOLEAN DEFAULT FALSE,
  f1_favorite_driver TEXT,
  f1_favorite_team TEXT,
  f1_spoiler_free BOOLEAN DEFAULT FALSE,

  -- F1 Session reminders
  f1_session_reminder_15m BOOLEAN DEFAULT TRUE,
  f1_session_reminder_1h BOOLEAN DEFAULT TRUE,
  f1_session_reminder_1d BOOLEAN DEFAULT FALSE,

  -- F1 Results
  f1_race_results BOOLEAN DEFAULT TRUE,
  f1_quali_results BOOLEAN DEFAULT FALSE,
  f1_sprint_results BOOLEAN DEFAULT FALSE,
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

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- RLS for notification_preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can insert own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can update own notification preferences" ON notification_preferences;

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
-- NOTIFICATION LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'delivered', 'read')),
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_user_sent
  ON notification_log(user_id, sent_at DESC);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notification log" ON notification_log;
DROP POLICY IF EXISTS "Service role can insert notification log" ON notification_log;

CREATE POLICY "Users can view own notification log"
  ON notification_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notification log"
  ON notification_log FOR INSERT
  WITH CHECK (true);

-- ============================================
-- SHOPPING LIST CHANGES TRACKING (for debounce)
-- ============================================
CREATE TABLE IF NOT EXISTS shopping_list_changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('added', 'removed', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopping_list_changes_user_created
  ON shopping_list_changes(user_id, created_at DESC);

ALTER TABLE shopping_list_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage shopping list changes" ON shopping_list_changes;

CREATE POLICY "Service role can manage shopping list changes"
  ON shopping_list_changes FOR ALL
  USING (true);

-- ============================================
-- ADD COLUMNS TO EXISTING TABLES IF NEEDED
-- ============================================

-- Add reminder tracking to calendar_events if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'reminder_15m_sent') THEN
    ALTER TABLE calendar_events ADD COLUMN reminder_15m_sent TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'reminder_1h_sent') THEN
    ALTER TABLE calendar_events ADD COLUMN reminder_1h_sent TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'reminder_1d_sent') THEN
    ALTER TABLE calendar_events ADD COLUMN reminder_1d_sent TIMESTAMPTZ;
  END IF;
END $$;

-- Add reminder tracking to routines if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'routines' AND column_name = 'last_reminder_sent') THEN
    ALTER TABLE routines ADD COLUMN last_reminder_sent TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'routines' AND column_name = 'reminder_enabled') THEN
    ALTER TABLE routines ADD COLUMN reminder_enabled BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE notification_preferences IS 'User preferences for all notification types';
COMMENT ON TABLE notification_log IS 'Log of all sent notifications';
COMMENT ON TABLE shopping_list_changes IS 'Tracks recent shopping list changes for batch notifications with debounce';
