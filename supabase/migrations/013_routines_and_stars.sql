-- Migration: Add stars_enabled to family_members and enhanced routines support
-- Date: 2026-01-15

-- Add stars_enabled column to family_members (defaults to true)
ALTER TABLE family_members
ADD COLUMN IF NOT EXISTS stars_enabled BOOLEAN DEFAULT true;

-- Create routines table (if not exists)
CREATE TABLE IF NOT EXISTS routines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📋',
  type TEXT NOT NULL DEFAULT 'custom' CHECK (type IN ('morning', 'evening', 'custom')),
  scheduled_time TIME,
  points_reward INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add points_reward column if table already exists without it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routines' AND column_name = 'points_reward') THEN
    ALTER TABLE routines ADD COLUMN points_reward INTEGER NOT NULL DEFAULT 1;
  END IF;
END $$;

-- Drop old assigned_to column if it exists (we're using junction table now)
ALTER TABLE routines DROP COLUMN IF EXISTS assigned_to;

-- Create routine_members junction table (who participates in each routine)
CREATE TABLE IF NOT EXISTS routine_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(routine_id, member_id)
);

-- Create routine_steps table
CREATE TABLE IF NOT EXISTS routine_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '✅',
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Drop and recreate routine_completions if it exists without member_id
-- First check if table exists and is missing member_id column
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'routine_completions') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routine_completions' AND column_name = 'member_id') THEN
      -- Table exists but without member_id - drop and recreate
      DROP TABLE routine_completions;
    END IF;
  END IF;
END $$;

-- Create routine_completions table (tracks per-member, per-step, per-day)
CREATE TABLE IF NOT EXISTS routine_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES routine_steps(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(routine_id, step_id, member_id, completed_date)
);

-- Enable RLS
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_completions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own routines" ON routines;
DROP POLICY IF EXISTS "Users can insert their own routines" ON routines;
DROP POLICY IF EXISTS "Users can update their own routines" ON routines;
DROP POLICY IF EXISTS "Users can delete their own routines" ON routines;
DROP POLICY IF EXISTS "Users can view routine members for their routines" ON routine_members;
DROP POLICY IF EXISTS "Users can insert routine members for their routines" ON routine_members;
DROP POLICY IF EXISTS "Users can delete routine members for their routines" ON routine_members;
DROP POLICY IF EXISTS "Users can view steps for their routines" ON routine_steps;
DROP POLICY IF EXISTS "Users can insert steps for their routines" ON routine_steps;
DROP POLICY IF EXISTS "Users can update steps for their routines" ON routine_steps;
DROP POLICY IF EXISTS "Users can delete steps for their routines" ON routine_steps;
DROP POLICY IF EXISTS "Users can view completions for their routines" ON routine_completions;
DROP POLICY IF EXISTS "Users can insert completions for their routines" ON routine_completions;
DROP POLICY IF EXISTS "Users can delete completions for their routines" ON routine_completions;

-- RLS Policies for routines
CREATE POLICY "Users can view their own routines" ON routines
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own routines" ON routines
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own routines" ON routines
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own routines" ON routines
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for routine_members
CREATE POLICY "Users can view routine members for their routines" ON routine_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_members.routine_id AND routines.user_id = auth.uid())
  );
CREATE POLICY "Users can insert routine members for their routines" ON routine_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_members.routine_id AND routines.user_id = auth.uid())
  );
CREATE POLICY "Users can delete routine members for their routines" ON routine_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_members.routine_id AND routines.user_id = auth.uid())
  );

-- RLS Policies for routine_steps
CREATE POLICY "Users can view steps for their routines" ON routine_steps
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_steps.routine_id AND routines.user_id = auth.uid())
  );
CREATE POLICY "Users can insert steps for their routines" ON routine_steps
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_steps.routine_id AND routines.user_id = auth.uid())
  );
CREATE POLICY "Users can update steps for their routines" ON routine_steps
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_steps.routine_id AND routines.user_id = auth.uid())
  );
CREATE POLICY "Users can delete steps for their routines" ON routine_steps
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_steps.routine_id AND routines.user_id = auth.uid())
  );

-- RLS Policies for routine_completions
CREATE POLICY "Users can view completions for their routines" ON routine_completions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_completions.routine_id AND routines.user_id = auth.uid())
  );
CREATE POLICY "Users can insert completions for their routines" ON routine_completions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_completions.routine_id AND routines.user_id = auth.uid())
  );
CREATE POLICY "Users can delete completions for their routines" ON routine_completions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_completions.routine_id AND routines.user_id = auth.uid())
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_routines_user_id ON routines(user_id);
CREATE INDEX IF NOT EXISTS idx_routine_members_routine_id ON routine_members(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_members_member_id ON routine_members(member_id);
CREATE INDEX IF NOT EXISTS idx_routine_steps_routine_id ON routine_steps(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_completions_routine_id ON routine_completions(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_completions_date ON routine_completions(completed_date);
CREATE INDEX IF NOT EXISTS idx_routine_completions_member ON routine_completions(member_id, completed_date);
