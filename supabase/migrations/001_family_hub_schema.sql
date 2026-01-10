-- Family Hub Complete Schema
-- Run this migration in Supabase SQL Editor

-- ============================================
-- FAMILY MEMBERS
-- ============================================
CREATE TABLE IF NOT EXISTS family_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  role TEXT NOT NULL DEFAULT 'child' CHECK (role IN ('parent', 'child', 'pet')),
  avatar TEXT,
  points INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for family_members
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own family members" ON family_members
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own family members" ON family_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own family members" ON family_members
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own family members" ON family_members
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- CALENDAR EVENTS
-- ============================================
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT FALSE,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  member_id UUID REFERENCES family_members(id) ON DELETE SET NULL,
  location TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'google', 'apple', 'outlook')),
  source_id TEXT,
  recurrence_rule TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for calendar_events
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calendar events" ON calendar_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar events" ON calendar_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar events" ON calendar_events
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar events" ON calendar_events
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- CHORES / TASKS
-- ============================================
CREATE TABLE IF NOT EXISTS chores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  emoji TEXT DEFAULT '✨',
  description TEXT,
  assigned_to UUID REFERENCES family_members(id) ON DELETE SET NULL,
  points INTEGER DEFAULT 1,
  due_date DATE,
  due_time TIME,
  repeat_frequency TEXT CHECK (repeat_frequency IN ('none', 'daily', 'weekly', 'monthly', 'custom')),
  repeat_interval INTEGER DEFAULT 1,
  repeat_days INTEGER[], -- 0-6 for Sunday-Saturday
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'skipped')),
  category TEXT DEFAULT 'general',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES family_members(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for chores
ALTER TABLE chores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chores" ON chores
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chores" ON chores
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chores" ON chores
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chores" ON chores
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- ROUTINES
-- ============================================
CREATE TABLE IF NOT EXISTS routines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  emoji TEXT DEFAULT '📋',
  type TEXT DEFAULT 'custom' CHECK (type IN ('morning', 'evening', 'custom')),
  assigned_to UUID REFERENCES family_members(id) ON DELETE SET NULL,
  scheduled_time TIME,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for routines
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own routines" ON routines
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own routines" ON routines
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own routines" ON routines
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own routines" ON routines
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- ROUTINE STEPS
-- ============================================
CREATE TABLE IF NOT EXISTS routine_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  routine_id UUID REFERENCES routines(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  emoji TEXT DEFAULT '⭐',
  duration_minutes INTEGER DEFAULT 5,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for routine_steps
ALTER TABLE routine_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view routine steps" ON routine_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM routines WHERE routines.id = routine_steps.routine_id AND routines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert routine steps" ON routine_steps
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM routines WHERE routines.id = routine_steps.routine_id AND routines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update routine steps" ON routine_steps
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM routines WHERE routines.id = routine_steps.routine_id AND routines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete routine steps" ON routine_steps
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM routines WHERE routines.id = routine_steps.routine_id AND routines.user_id = auth.uid()
    )
  );

-- ============================================
-- ROUTINE COMPLETIONS (daily tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS routine_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  routine_id UUID REFERENCES routines(id) ON DELETE CASCADE,
  step_id UUID REFERENCES routine_steps(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_by UUID REFERENCES family_members(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(routine_id, step_id, completed_date)
);

-- RLS for routine_completions
ALTER TABLE routine_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view routine completions" ON routine_completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM routines WHERE routines.id = routine_completions.routine_id AND routines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert routine completions" ON routine_completions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM routines WHERE routines.id = routine_completions.routine_id AND routines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete routine completions" ON routine_completions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM routines WHERE routines.id = routine_completions.routine_id AND routines.user_id = auth.uid()
    )
  );

-- ============================================
-- REWARDS (Prize Vault)
-- ============================================
CREATE TABLE IF NOT EXISTS rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  emoji TEXT DEFAULT '🎁',
  description TEXT,
  point_cost INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for rewards
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rewards" ON rewards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rewards" ON rewards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rewards" ON rewards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rewards" ON rewards
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- REWARD REDEMPTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS reward_redemptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reward_id UUID REFERENCES rewards(id) ON DELETE CASCADE,
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  points_spent INTEGER NOT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for reward_redemptions
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reward redemptions" ON reward_redemptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM rewards WHERE rewards.id = reward_redemptions.reward_id AND rewards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert reward redemptions" ON reward_redemptions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM rewards WHERE rewards.id = reward_redemptions.reward_id AND rewards.user_id = auth.uid()
    )
  );

-- ============================================
-- NOTES (Family Pinboard)
-- ============================================
CREATE TABLE IF NOT EXISTS notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  color TEXT DEFAULT '#fef3c7',
  pinned BOOLEAN DEFAULT FALSE,
  author_id UUID REFERENCES family_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for notes
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notes" ON notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes" ON notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes" ON notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes" ON notes
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- DASHBOARD PAGES
-- ============================================
CREATE TABLE IF NOT EXISTS dashboard_pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Home',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for dashboard_pages
ALTER TABLE dashboard_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dashboard pages" ON dashboard_pages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dashboard pages" ON dashboard_pages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dashboard pages" ON dashboard_pages
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own dashboard pages" ON dashboard_pages
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- DASHBOARD WIDGETS
-- ============================================
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id UUID REFERENCES dashboard_pages(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL,
  title TEXT,
  config JSONB DEFAULT '{}',
  layout_lg JSONB NOT NULL DEFAULT '{"x": 0, "y": 0, "w": 2, "h": 2}',
  layout_md JSONB NOT NULL DEFAULT '{"x": 0, "y": 0, "w": 2, "h": 2}',
  layout_sm JSONB NOT NULL DEFAULT '{"x": 0, "y": 0, "w": 1, "h": 2}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for dashboard_widgets
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view dashboard widgets" ON dashboard_widgets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dashboard_pages WHERE dashboard_pages.id = dashboard_widgets.page_id AND dashboard_pages.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert dashboard widgets" ON dashboard_widgets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM dashboard_pages WHERE dashboard_pages.id = dashboard_widgets.page_id AND dashboard_pages.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update dashboard widgets" ON dashboard_widgets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM dashboard_pages WHERE dashboard_pages.id = dashboard_widgets.page_id AND dashboard_pages.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete dashboard widgets" ON dashboard_widgets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM dashboard_pages WHERE dashboard_pages.id = dashboard_widgets.page_id AND dashboard_pages.user_id = auth.uid()
    )
  );

-- ============================================
-- APP SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key)
);

-- RLS for app_settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON app_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON app_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON app_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings" ON app_settings
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_chores_user_id ON chores(user_id);
CREATE INDEX IF NOT EXISTS idx_chores_due_date ON chores(due_date);
CREATE INDEX IF NOT EXISTS idx_chores_assigned_to ON chores(assigned_to);
CREATE INDEX IF NOT EXISTS idx_routines_user_id ON routines(user_id);
CREATE INDEX IF NOT EXISTS idx_routine_completions_date ON routine_completions(completed_date);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_pages_user_id ON dashboard_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_user_key ON app_settings(user_id, key);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_family_members_updated_at BEFORE UPDATE ON family_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chores_updated_at BEFORE UPDATE ON chores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_routines_updated_at BEFORE UPDATE ON routines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rewards_updated_at BEFORE UPDATE ON rewards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dashboard_pages_updated_at BEFORE UPDATE ON dashboard_pages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dashboard_widgets_updated_at BEFORE UPDATE ON dashboard_widgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
