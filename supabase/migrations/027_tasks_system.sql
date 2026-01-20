-- Tasks System Migration
-- Smart task management with AI parsing and context-aware reminders

-- ============================================
-- TASK CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS task_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '📌',
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- RLS for task_categories
ALTER TABLE task_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own task categories" ON task_categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own task categories" ON task_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own task categories" ON task_categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own task categories" ON task_categories
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- TASKS
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Core task info
  title TEXT NOT NULL,
  description TEXT,
  raw_input TEXT, -- Original message/input for AI context

  -- Assignment
  assignee_id UUID REFERENCES family_members(id) ON DELETE SET NULL,
  creator_id UUID REFERENCES family_members(id) ON DELETE SET NULL,

  -- Categorization
  category_id UUID REFERENCES task_categories(id) ON DELETE SET NULL,

  -- Timing
  due_date DATE,
  due_time TIME,
  due_context TEXT, -- e.g., "at work", "before dinner", "this weekend"

  -- Urgency (AI-detected or manual)
  urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'urgent')),

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'archived', 'snoozed')),
  snoozed_until TIMESTAMPTZ,

  -- Recurrence (optional)
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_rule TEXT, -- RRULE format

  -- Calendar integration (optional)
  calendar_event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,

  -- AI parsing metadata
  ai_parsed BOOLEAN DEFAULT FALSE,
  ai_confidence DECIMAL(3,2), -- 0.00 to 1.00
  ai_parsed_at TIMESTAMPTZ,

  -- Completion tracking
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES family_members(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks" ON tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks" ON tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks" ON tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks" ON tasks
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- TASK REMINDERS
-- Smart reminder scheduling
-- ============================================
CREATE TABLE IF NOT EXISTS task_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL,
  reminder_type TEXT DEFAULT 'push' CHECK (reminder_type IN ('push', 'email', 'sms')),

  -- Smart reminder context
  context_reason TEXT, -- e.g., "weekday work reminder", "evening follow-up"
  attempt_number INTEGER DEFAULT 1, -- 1st, 2nd, 3rd reminder

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'acknowledged', 'skipped', 'failed')),
  sent_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,

  -- User response
  response TEXT CHECK (response IN ('done', 'in_progress', 'snooze_1h', 'snooze_tomorrow', 'dismissed')),
  response_at TIMESTAMPTZ,

  -- Error tracking
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for task_reminders
ALTER TABLE task_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own task reminders" ON task_reminders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own task reminders" ON task_reminders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own task reminders" ON task_reminders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own task reminders" ON task_reminders
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_category_id ON tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_task_reminders_task_id ON task_reminders(task_id);
CREATE INDEX IF NOT EXISTS idx_task_reminders_scheduled ON task_reminders(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_task_categories_user_id ON task_categories(user_id);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_categories_updated_at
  BEFORE UPDATE ON task_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DEFAULT CATEGORIES (inserted per-user on first task)
-- ============================================
-- These will be created via API when user creates their first task

-- ============================================
-- FUNCTION: Schedule smart reminders for a task
-- ============================================
CREATE OR REPLACE FUNCTION schedule_task_reminders(
  p_task_id UUID,
  p_user_id UUID,
  p_due_date DATE,
  p_due_time TIME,
  p_due_context TEXT,
  p_created_at TIMESTAMPTZ
) RETURNS void AS $$
DECLARE
  v_due_datetime TIMESTAMPTZ;
  v_created_date DATE;
  v_day_of_week INTEGER;
  v_is_weekday BOOLEAN;
  v_reminder_time TIME;
BEGIN
  -- Calculate due datetime
  v_due_datetime := (p_due_date || ' ' || COALESCE(p_due_time, '17:00:00'))::TIMESTAMPTZ;
  v_created_date := p_created_at::DATE;
  v_day_of_week := EXTRACT(DOW FROM p_created_at);
  v_is_weekday := v_day_of_week BETWEEN 1 AND 5;

  -- If task created on weekday (likely at work), schedule work-aware reminders
  IF v_is_weekday AND (p_due_context IS NULL OR p_due_context NOT ILIKE '%weekend%') THEN
    -- First reminder: 4:30 PM (end of work day)
    INSERT INTO task_reminders (task_id, user_id, scheduled_for, context_reason, attempt_number)
    VALUES (
      p_task_id,
      p_user_id,
      (v_created_date || ' 16:30:00')::TIMESTAMPTZ,
      'End of work day reminder',
      1
    )
    ON CONFLICT DO NOTHING;

    -- Second reminder: 6:30 PM (after commute)
    INSERT INTO task_reminders (task_id, user_id, scheduled_for, context_reason, attempt_number)
    VALUES (
      p_task_id,
      p_user_id,
      (v_created_date || ' 18:30:00')::TIMESTAMPTZ,
      'Evening follow-up',
      2
    )
    ON CONFLICT DO NOTHING;

    -- Third reminder: 7:30 PM (final evening reminder)
    INSERT INTO task_reminders (task_id, user_id, scheduled_for, context_reason, attempt_number)
    VALUES (
      p_task_id,
      p_user_id,
      (v_created_date || ' 19:30:00')::TIMESTAMPTZ,
      'Final evening reminder',
      3
    )
    ON CONFLICT DO NOTHING;
  ELSE
    -- Weekend or explicit non-work context: simpler reminder schedule
    -- Morning reminder
    INSERT INTO task_reminders (task_id, user_id, scheduled_for, context_reason, attempt_number)
    VALUES (
      p_task_id,
      p_user_id,
      (v_created_date || ' 10:00:00')::TIMESTAMPTZ,
      'Morning reminder',
      1
    )
    ON CONFLICT DO NOTHING;

    -- Afternoon reminder
    INSERT INTO task_reminders (task_id, user_id, scheduled_for, context_reason, attempt_number)
    VALUES (
      p_task_id,
      p_user_id,
      (v_created_date || ' 15:00:00')::TIMESTAMPTZ,
      'Afternoon follow-up',
      2
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- If due date is different from created date, add day-before reminder
  IF p_due_date > v_created_date THEN
    INSERT INTO task_reminders (task_id, user_id, scheduled_for, context_reason, attempt_number)
    VALUES (
      p_task_id,
      p_user_id,
      ((p_due_date - INTERVAL '1 day') || ' 20:00:00')::TIMESTAMPTZ,
      'Due tomorrow - evening reminder',
      1
    )
    ON CONFLICT DO NOTHING;

    -- Morning of due date
    INSERT INTO task_reminders (task_id, user_id, scheduled_for, context_reason, attempt_number)
    VALUES (
      p_task_id,
      p_user_id,
      (p_due_date || ' 09:00:00')::TIMESTAMPTZ,
      'Due today - morning reminder',
      2
    )
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ADD TASK NOTIFICATION PREFERENCES
-- ============================================
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS tasks_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS tasks_reminder_frequency TEXT DEFAULT 'smart'
    CHECK (tasks_reminder_frequency IN ('smart', 'minimal', 'aggressive', 'none'));
