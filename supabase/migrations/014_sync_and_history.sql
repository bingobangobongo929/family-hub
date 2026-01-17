-- Migration: Full Sync Infrastructure and History Tracking
-- Date: 2026-01-17
-- Purpose:
--   1. Per-user preferences (theme, locale) synced via Supabase
--   2. Routine schedule flexibility (weekday/weekend)
--   3. Historical logging for routine completions
--   4. Streak tracking for gamification
--   5. Points history for audit trail

-- ============================================
-- 1. USER PREFERENCES TABLE
-- Stores per-user settings that sync across devices
-- ============================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  locale TEXT DEFAULT 'en' CHECK (locale IN ('en', 'da')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- RLS for user_preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own preferences" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own preferences" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- ============================================
-- 2. ROUTINE SCHEDULE FLEXIBILITY
-- Add schedule_type to control when routines appear
-- ============================================

-- Add schedule_type column (daily, weekdays, weekends, custom)
ALTER TABLE routines ADD COLUMN IF NOT EXISTS schedule_type TEXT DEFAULT 'daily'
  CHECK (schedule_type IN ('daily', 'weekdays', 'weekends', 'custom'));

-- Add schedule_days for custom schedules (array of day numbers: 0=Sun, 1=Mon, etc.)
ALTER TABLE routines ADD COLUMN IF NOT EXISTS schedule_days INTEGER[] DEFAULT NULL;

-- Index for filtering by schedule type
CREATE INDEX IF NOT EXISTS idx_routines_schedule_type ON routines(schedule_type);

-- ============================================
-- 3. ROUTINE COMPLETION LOG (Immutable History)
-- Append-only audit trail of all routine actions
-- ============================================

CREATE TABLE IF NOT EXISTS routine_completion_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES routine_steps(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_by UUID REFERENCES auth.users(id), -- Who marked it (parent tracking for child)
  action TEXT NOT NULL CHECK (action IN ('completed', 'uncompleted', 'skipped')),
  notes TEXT -- Optional context: "sick day", "forgot", etc.
);

-- RLS for routine_completion_log
ALTER TABLE routine_completion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view completion logs for their routines" ON routine_completion_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_completion_log.routine_id AND routines.user_id = auth.uid())
  );
CREATE POLICY "Users can insert completion logs for their routines" ON routine_completion_log
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_completion_log.routine_id AND routines.user_id = auth.uid())
  );
-- Note: No UPDATE or DELETE policies - this table is append-only

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_completion_log_routine_id ON routine_completion_log(routine_id);
CREATE INDEX IF NOT EXISTS idx_completion_log_member_id ON routine_completion_log(member_id);
CREATE INDEX IF NOT EXISTS idx_completion_log_date ON routine_completion_log(completed_date);
CREATE INDEX IF NOT EXISTS idx_completion_log_member_date ON routine_completion_log(member_id, completed_date);

-- ============================================
-- 4. MEMBER STREAKS TABLE
-- Cached streak calculations for performance
-- ============================================

CREATE TABLE IF NOT EXISTS member_streaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_completed_date DATE,
  streak_started_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, routine_id)
);

-- RLS for member_streaks
ALTER TABLE member_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view streaks for their family members" ON member_streaks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM family_members WHERE family_members.id = member_streaks.member_id AND family_members.user_id = auth.uid())
  );
CREATE POLICY "Users can insert streaks for their family members" ON member_streaks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM family_members WHERE family_members.id = member_streaks.member_id AND family_members.user_id = auth.uid())
  );
CREATE POLICY "Users can update streaks for their family members" ON member_streaks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM family_members WHERE family_members.id = member_streaks.member_id AND family_members.user_id = auth.uid())
  );
CREATE POLICY "Users can delete streaks for their family members" ON member_streaks
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM family_members WHERE family_members.id = member_streaks.member_id AND family_members.user_id = auth.uid())
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_member_streaks_member_id ON member_streaks(member_id);
CREATE INDEX IF NOT EXISTS idx_member_streaks_routine_id ON member_streaks(routine_id);

-- ============================================
-- 5. POINTS HISTORY TABLE
-- Track all point changes with reasons
-- ============================================

CREATE TABLE IF NOT EXISTS points_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  points_change INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'routine_completed',
    'chore_completed',
    'reward_redeemed',
    'manual_adjustment',
    'streak_bonus'
  )),
  reference_id UUID, -- routine_id, chore_id, reward_id, or null for manual
  reference_type TEXT, -- 'routine', 'chore', 'reward', null
  notes TEXT, -- Optional description
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS for points_history
ALTER TABLE points_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view points history for their family members" ON points_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM family_members WHERE family_members.id = points_history.member_id AND family_members.user_id = auth.uid())
  );
CREATE POLICY "Users can insert points history for their family members" ON points_history
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM family_members WHERE family_members.id = points_history.member_id AND family_members.user_id = auth.uid())
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_points_history_member_id ON points_history(member_id);
CREATE INDEX IF NOT EXISTS idx_points_history_created_at ON points_history(created_at);
CREATE INDEX IF NOT EXISTS idx_points_history_member_date ON points_history(member_id, created_at);

-- ============================================
-- 6. HELPER FUNCTION: Check if routine applies today
-- ============================================

CREATE OR REPLACE FUNCTION routine_applies_today(
  p_schedule_type TEXT,
  p_schedule_days INTEGER[]
) RETURNS BOOLEAN AS $$
DECLARE
  v_day_of_week INTEGER;
BEGIN
  -- Get current day of week (0 = Sunday, 6 = Saturday)
  v_day_of_week := EXTRACT(DOW FROM CURRENT_DATE);

  CASE p_schedule_type
    WHEN 'daily' THEN
      RETURN TRUE;
    WHEN 'weekdays' THEN
      RETURN v_day_of_week BETWEEN 1 AND 5; -- Mon-Fri
    WHEN 'weekends' THEN
      RETURN v_day_of_week IN (0, 6); -- Sat-Sun
    WHEN 'custom' THEN
      RETURN v_day_of_week = ANY(p_schedule_days);
    ELSE
      RETURN TRUE; -- Default to showing
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 7. VIEW: Today's applicable routines
-- ============================================

CREATE OR REPLACE VIEW routines_today AS
SELECT r.*
FROM routines r
WHERE r.is_active = TRUE
  AND routine_applies_today(r.schedule_type, r.schedule_days);

-- ============================================
-- 8. Trigger: Auto-update updated_at timestamps
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to user_preferences
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply to member_streaks
DROP TRIGGER IF EXISTS update_member_streaks_updated_at ON member_streaks;
CREATE TRIGGER update_member_streaks_updated_at
  BEFORE UPDATE ON member_streaks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
