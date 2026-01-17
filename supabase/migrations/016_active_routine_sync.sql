-- Migration: Active Routine Sync
-- Date: 2026-01-17
-- Purpose: Store which routine is currently active so all family members see the same state

CREATE TABLE IF NOT EXISTS active_routine_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_id UUID REFERENCES routines(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  started_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- RLS for active_routine_state
ALTER TABLE active_routine_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their active routine" ON active_routine_state
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their active routine" ON active_routine_state
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their active routine" ON active_routine_state
  FOR UPDATE USING (user_id = auth.uid());

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_active_routine_state_user_date ON active_routine_state(user_id, date);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_active_routine_state_updated_at ON active_routine_state;
CREATE TRIGGER update_active_routine_state_updated_at
  BEFORE UPDATE ON active_routine_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE active_routine_state;
