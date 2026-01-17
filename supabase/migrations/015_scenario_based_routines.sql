-- Migration: Scenario-Based Routines
-- Date: 2026-01-17
-- Purpose:
--   1. Add scenarios to routines (Daycare, Home, Swimming, etc.)
--   2. Per-step scenario visibility (which scenarios show this step)
--   3. Per-step member assignment (which children this step applies to)
--   4. Daily state to remember selected scenarios
--   5. Smart defaults based on day of week

-- ============================================
-- 1. ROUTINE SCENARIOS TABLE
-- Defines available scenarios for each routine
-- ============================================

CREATE TABLE IF NOT EXISTS routine_scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📋',
  is_going_out BOOLEAN DEFAULT FALSE,  -- Used for outdoor-related steps
  is_default_weekday BOOLEAN DEFAULT FALSE,
  is_default_weekend BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for routine_scenarios
ALTER TABLE routine_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view scenarios for their routines" ON routine_scenarios
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_scenarios.routine_id AND routines.user_id = auth.uid())
  );
CREATE POLICY "Users can insert scenarios for their routines" ON routine_scenarios
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_scenarios.routine_id AND routines.user_id = auth.uid())
  );
CREATE POLICY "Users can update scenarios for their routines" ON routine_scenarios
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_scenarios.routine_id AND routines.user_id = auth.uid())
  );
CREATE POLICY "Users can delete scenarios for their routines" ON routine_scenarios
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_scenarios.routine_id AND routines.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_routine_scenarios_routine_id ON routine_scenarios(routine_id);

-- ============================================
-- 2. UPDATE ROUTINE_STEPS TABLE
-- Add scenario and member filtering
-- ============================================

-- scenario_ids: NULL means "always show", array of IDs means "only show for these scenarios"
ALTER TABLE routine_steps ADD COLUMN IF NOT EXISTS scenario_ids UUID[] DEFAULT NULL;

-- member_ids: NULL means "all members", array of IDs means "only for these members"
ALTER TABLE routine_steps ADD COLUMN IF NOT EXISTS member_ids UUID[] DEFAULT NULL;

-- ============================================
-- 3. ROUTINE DAILY STATE TABLE
-- Remembers which scenarios were selected for each day
-- ============================================

CREATE TABLE IF NOT EXISTS routine_daily_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  selected_scenario_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(routine_id, date)
);

-- RLS for routine_daily_state
ALTER TABLE routine_daily_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view daily state for their routines" ON routine_daily_state
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_daily_state.routine_id AND routines.user_id = auth.uid())
  );
CREATE POLICY "Users can insert daily state for their routines" ON routine_daily_state
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_daily_state.routine_id AND routines.user_id = auth.uid())
  );
CREATE POLICY "Users can update daily state for their routines" ON routine_daily_state
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_daily_state.routine_id AND routines.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_routine_daily_state_routine_date ON routine_daily_state(routine_id, date);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_routine_daily_state_updated_at ON routine_daily_state;
CREATE TRIGGER update_routine_daily_state_updated_at
  BEFORE UPDATE ON routine_daily_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. HELPER FUNCTION: Check if step should be visible
-- ============================================

CREATE OR REPLACE FUNCTION step_visible_for_scenarios(
  p_step_scenario_ids UUID[],
  p_selected_scenario_ids UUID[]
) RETURNS BOOLEAN AS $$
BEGIN
  -- If step has no scenario restriction, always show
  IF p_step_scenario_ids IS NULL OR array_length(p_step_scenario_ids, 1) IS NULL THEN
    RETURN TRUE;
  END IF;

  -- If no scenarios selected, only show unrestricted steps
  IF p_selected_scenario_ids IS NULL OR array_length(p_selected_scenario_ids, 1) IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if any selected scenario matches step's scenarios
  RETURN p_step_scenario_ids && p_selected_scenario_ids;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 5. HELPER FUNCTION: Check if step applies to member
-- ============================================

CREATE OR REPLACE FUNCTION step_applies_to_member(
  p_step_member_ids UUID[],
  p_member_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  -- If step has no member restriction, applies to all
  IF p_step_member_ids IS NULL OR array_length(p_step_member_ids, 1) IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Check if member is in the list
  RETURN p_member_id = ANY(p_step_member_ids);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
