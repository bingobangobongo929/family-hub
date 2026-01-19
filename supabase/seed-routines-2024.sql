-- Seed Script: Family Routines for Olivia and Ellie
-- Run this after migration 024_flexible_routines.sql
--
-- INSTRUCTIONS:
-- 1. Run the migration first: 024_flexible_routines.sql
-- 2. Run this seed script in Supabase SQL Editor
-- 3. This will DELETE all existing routines and create new ones
--
-- ROUTINES CREATED:
-- - Weekday Morning (Mon-Fri): Breakfast, Milk, Teeth, Diaper, Dressed, Hair (Olivia only), Coat & Shoes
-- - Weekend Morning (Sat-Sun): Milk, Teeth, Breakfast, Diaper
-- - Evening (Daily): Pjamas, Porridge, Teeth, Milk, Hug & Kiss
-- - Going Out (Manual): Coat/Hat/Boots, Changing Bag, Water, Leo Lion (Olivia only)

DO $$
DECLARE
  v_user_id UUID;
  v_olivia_id UUID;
  v_ellie_id UUID;
  v_routine_id UUID;
  v_step_id UUID;
BEGIN
  -- Get the authenticated user (you may need to hardcode this or run as that user)
  -- Option 1: Use current authenticated user
  v_user_id := auth.uid();

  -- Option 2: If running as admin, find user by email (uncomment and modify):
  -- SELECT id INTO v_user_id FROM auth.users WHERE email = 'your-email@example.com';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found. Run this while logged in or specify user ID.';
  END IF;

  -- Find Olivia and Ellie by name
  SELECT id INTO v_olivia_id FROM family_members
    WHERE user_id = v_user_id AND LOWER(name) LIKE '%olivia%' LIMIT 1;
  SELECT id INTO v_ellie_id FROM family_members
    WHERE user_id = v_user_id AND LOWER(name) LIKE '%ellie%' LIMIT 1;

  IF v_olivia_id IS NULL THEN
    RAISE EXCEPTION 'Could not find family member named Olivia';
  END IF;
  IF v_ellie_id IS NULL THEN
    RAISE EXCEPTION 'Could not find family member named Ellie';
  END IF;

  RAISE NOTICE 'Found Olivia: %, Ellie: %', v_olivia_id, v_ellie_id;

  -- ============================================
  -- DELETE EXISTING ROUTINES (clean slate)
  -- ============================================
  DELETE FROM routine_completions WHERE routine_id IN (SELECT id FROM routines WHERE user_id = v_user_id);
  DELETE FROM routine_members WHERE routine_id IN (SELECT id FROM routines WHERE user_id = v_user_id);
  DELETE FROM routine_steps WHERE routine_id IN (SELECT id FROM routines WHERE user_id = v_user_id);
  DELETE FROM routine_scenarios WHERE routine_id IN (SELECT id FROM routines WHERE user_id = v_user_id);
  DELETE FROM routine_daily_state WHERE routine_id IN (SELECT id FROM routines WHERE user_id = v_user_id);
  DELETE FROM routines WHERE user_id = v_user_id;

  RAISE NOTICE 'Deleted existing routines';

  -- ============================================
  -- 1. WEEKDAY MORNING ROUTINE (Mon-Fri)
  -- ============================================
  INSERT INTO routines (user_id, title, emoji, type, schedule_type, completion_mode, scheduled_time, points_reward, is_active, sort_order)
  VALUES (v_user_id, 'Weekday Morning', '☀️', 'morning', 'weekdays', 'flexible', '07:00', 2, true, 0)
  RETURNING id INTO v_routine_id;

  -- Assign both kids to routine
  INSERT INTO routine_members (routine_id, member_id) VALUES (v_routine_id, v_olivia_id);
  INSERT INTO routine_members (routine_id, member_id) VALUES (v_routine_id, v_ellie_id);

  -- Steps (order is just default, can be completed in any order due to flexible mode)
  INSERT INTO routine_steps (routine_id, title, emoji, duration_minutes, sort_order, member_ids)
  VALUES
    (v_routine_id, 'Breakfast', '🥣', 15, 1, NULL),  -- Both kids
    (v_routine_id, 'Milk', '🥛', 5, 2, NULL),
    (v_routine_id, 'Teeth', '🪥', 3, 3, NULL),
    (v_routine_id, 'Diaper Change', '👶', 5, 4, NULL),
    (v_routine_id, 'Get Dressed', '👕', 5, 5, NULL),
    (v_routine_id, 'Hair', '💇‍♀️', 5, 6, ARRAY[v_olivia_id]),  -- Olivia only
    (v_routine_id, 'Coat & Shoes', '🥾', 5, 7, NULL);

  RAISE NOTICE 'Created Weekday Morning routine';

  -- ============================================
  -- 2. WEEKEND MORNING ROUTINE (Sat-Sun)
  -- ============================================
  INSERT INTO routines (user_id, title, emoji, type, schedule_type, completion_mode, scheduled_time, points_reward, is_active, sort_order)
  VALUES (v_user_id, 'Weekend Morning', '🌅', 'morning', 'weekends', 'flexible', '08:30', 2, true, 1)
  RETURNING id INTO v_routine_id;

  -- Assign both kids
  INSERT INTO routine_members (routine_id, member_id) VALUES (v_routine_id, v_olivia_id);
  INSERT INTO routine_members (routine_id, member_id) VALUES (v_routine_id, v_ellie_id);

  -- Steps (fewer steps, no coat/shoes since not going out)
  INSERT INTO routine_steps (routine_id, title, emoji, duration_minutes, sort_order, member_ids)
  VALUES
    (v_routine_id, 'Milk', '🥛', 5, 1, NULL),
    (v_routine_id, 'Teeth', '🪥', 3, 2, NULL),
    (v_routine_id, 'Breakfast', '🥣', 15, 3, NULL),
    (v_routine_id, 'Diaper Change', '👶', 5, 4, NULL);

  RAISE NOTICE 'Created Weekend Morning routine';

  -- ============================================
  -- 3. EVENING ROUTINE (Daily)
  -- ============================================
  INSERT INTO routines (user_id, title, emoji, type, schedule_type, completion_mode, scheduled_time, points_reward, is_active, sort_order)
  VALUES (v_user_id, 'Bedtime', '🌙', 'evening', 'daily', 'flexible', '19:00', 2, true, 2)
  RETURNING id INTO v_routine_id;

  -- Assign both kids
  INSERT INTO routine_members (routine_id, member_id) VALUES (v_routine_id, v_olivia_id);
  INSERT INTO routine_members (routine_id, member_id) VALUES (v_routine_id, v_ellie_id);

  -- Steps
  INSERT INTO routine_steps (routine_id, title, emoji, duration_minutes, sort_order, member_ids)
  VALUES
    (v_routine_id, 'Pjamas', '👕', 5, 1, NULL),
    (v_routine_id, 'Porridge', '🥣', 10, 2, NULL),
    (v_routine_id, 'Teeth', '🪥', 3, 3, NULL),
    (v_routine_id, 'Milk', '🥛', 5, 4, NULL),
    (v_routine_id, 'Hug & Kiss', '😘', 2, 5, NULL);

  RAISE NOTICE 'Created Evening routine';

  -- ============================================
  -- 4. GOING OUT ROUTINE (Manual trigger)
  -- ============================================
  INSERT INTO routines (user_id, title, emoji, type, schedule_type, completion_mode, scheduled_time, points_reward, is_active, sort_order)
  VALUES (v_user_id, 'Going Out', '🚗', 'custom', 'manual', 'flexible', NULL, 1, true, 3)
  RETURNING id INTO v_routine_id;

  -- Assign both kids
  INSERT INTO routine_members (routine_id, member_id) VALUES (v_routine_id, v_olivia_id);
  INSERT INTO routine_members (routine_id, member_id) VALUES (v_routine_id, v_ellie_id);

  -- Steps
  INSERT INTO routine_steps (routine_id, title, emoji, duration_minutes, sort_order, member_ids)
  VALUES
    (v_routine_id, 'Coat, Hat & Boots', '🧥', 5, 1, NULL),
    (v_routine_id, 'Changing Bag', '👜', 2, 2, NULL),
    (v_routine_id, 'Water', '💧', 1, 3, NULL),
    (v_routine_id, 'Leo Lion', '🦁', 1, 4, ARRAY[v_olivia_id]);  -- Olivia only

  RAISE NOTICE 'Created Going Out routine';

  RAISE NOTICE '✅ All routines created successfully!';
END $$;

-- Verify what was created
SELECT r.title, r.schedule_type, r.completion_mode, COUNT(rs.id) as steps
FROM routines r
LEFT JOIN routine_steps rs ON rs.routine_id = r.id
GROUP BY r.id, r.title, r.schedule_type, r.completion_mode
ORDER BY r.sort_order;
