-- Migration: Fix routine_completions RLS to allow any authenticated user
-- The previous policy only allowed the routine owner to insert completions
-- This breaks family sharing where multiple users need to mark steps complete
-- Date: 2026-01-18

-- Drop the restrictive policies
DROP POLICY IF EXISTS "Users can view completions for their routines" ON routine_completions;
DROP POLICY IF EXISTS "Users can insert completions for their routines" ON routine_completions;
DROP POLICY IF EXISTS "Users can delete completions for their routines" ON routine_completions;
DROP POLICY IF EXISTS "Users can update completions for their routines" ON routine_completions;

-- Create new permissive policies for family sharing
-- Any authenticated user can view all completions
CREATE POLICY "Authenticated users can view all completions" ON routine_completions
  FOR SELECT USING (auth.role() = 'authenticated');

-- Any authenticated user can insert completions for any routine
CREATE POLICY "Authenticated users can insert completions" ON routine_completions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Any authenticated user can update completions
CREATE POLICY "Authenticated users can update completions" ON routine_completions
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Any authenticated user can delete completions
CREATE POLICY "Authenticated users can delete completions" ON routine_completions
  FOR DELETE USING (auth.role() = 'authenticated');

-- Also fix routine_completion_log if it exists (for skipped steps)
DROP POLICY IF EXISTS "Users can view completion log" ON routine_completion_log;
DROP POLICY IF EXISTS "Users can insert completion log" ON routine_completion_log;
DROP POLICY IF EXISTS "Users can delete completion log" ON routine_completion_log;

-- Check if table exists before creating policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'routine_completion_log') THEN
    EXECUTE 'CREATE POLICY "Authenticated users can view completion log" ON routine_completion_log
      FOR SELECT USING (auth.role() = ''authenticated'')';
    EXECUTE 'CREATE POLICY "Authenticated users can insert completion log" ON routine_completion_log
      FOR INSERT WITH CHECK (auth.role() = ''authenticated'')';
    EXECUTE 'CREATE POLICY "Authenticated users can update completion log" ON routine_completion_log
      FOR UPDATE USING (auth.role() = ''authenticated'')';
    EXECUTE 'CREATE POLICY "Authenticated users can delete completion log" ON routine_completion_log
      FOR DELETE USING (auth.role() = ''authenticated'')';
  END IF;
END $$;
