-- Migration: Fix routine_members RLS policies
-- The INSERT policy needs to check the routine belongs to user

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view routine members for their routines" ON routine_members;
DROP POLICY IF EXISTS "Users can insert routine members for their routines" ON routine_members;
DROP POLICY IF EXISTS "Users can delete routine members for their routines" ON routine_members;
DROP POLICY IF EXISTS "Users can update routine members for their routines" ON routine_members;

-- Recreate with proper policies
CREATE POLICY "Users can view routine members for their routines" ON routine_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_members.routine_id AND routines.user_id = auth.uid())
  );

CREATE POLICY "Users can insert routine members for their routines" ON routine_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_id AND routines.user_id = auth.uid())
  );

CREATE POLICY "Users can update routine members for their routines" ON routine_members
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_members.routine_id AND routines.user_id = auth.uid())
  );

CREATE POLICY "Users can delete routine members for their routines" ON routine_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_members.routine_id AND routines.user_id = auth.uid())
  );

-- Also enable realtime for routine_completions so step completions sync
ALTER PUBLICATION supabase_realtime ADD TABLE routine_completions;
