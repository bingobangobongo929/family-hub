-- Fix Routine Members: Run this to verify and fix member assignments
-- Run in Supabase SQL Editor

-- First, check what routines exist and their member counts
SELECT
  r.id,
  r.title,
  r.emoji,
  COUNT(rm.id) as member_count,
  STRING_AGG(fm.name, ', ') as members
FROM routines r
LEFT JOIN routine_members rm ON rm.routine_id = r.id
LEFT JOIN family_members fm ON fm.id = rm.member_id
GROUP BY r.id, r.title, r.emoji
ORDER BY r.sort_order;

-- Check what family members exist
SELECT id, name, role FROM family_members WHERE role = 'child';

-- If routines have no members, run this to add all children to all routines:
DO $$
DECLARE
  v_user_id UUID;
  v_routine RECORD;
  v_child RECORD;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;

  -- For each routine
  FOR v_routine IN SELECT id FROM routines WHERE user_id = v_user_id LOOP
    -- For each child
    FOR v_child IN SELECT id FROM family_members WHERE user_id = v_user_id AND role = 'child' LOOP
      -- Insert if not exists
      INSERT INTO routine_members (routine_id, member_id)
      VALUES (v_routine.id, v_child.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Added children to all routines';
END $$;

-- Verify the fix
SELECT
  r.title,
  COUNT(rm.id) as member_count,
  STRING_AGG(fm.name, ', ') as members
FROM routines r
LEFT JOIN routine_members rm ON rm.routine_id = r.id
LEFT JOIN family_members fm ON fm.id = rm.member_id
GROUP BY r.id, r.title
ORDER BY r.sort_order;
