-- Seed Routines for Family Hub
-- Run this SQL in Supabase SQL Editor after logging in
-- This creates the Morning (weekday/weekend) and Bedtime routines with steps for your children

-- First, let's get the user_id (assumes you're the only user or modify the email)
-- Replace 'your-email@example.com' with your actual email if needed
DO $$
DECLARE
  v_user_id UUID;
  v_olivia_id UUID;
  v_ellie_id UUID;
  v_weekday_morning_id UUID;
  v_weekend_morning_id UUID;
  v_bedtime_routine_id UUID;
BEGIN
  -- Get the user ID (first user found, or modify this query)
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found. Please login first.';
  END IF;

  -- Get Olivia's ID
  SELECT id INTO v_olivia_id
  FROM family_members
  WHERE user_id = v_user_id AND LOWER(name) = 'olivia';

  -- Get Ellie's ID
  SELECT id INTO v_ellie_id
  FROM family_members
  WHERE user_id = v_user_id AND LOWER(name) = 'ellie';

  IF v_olivia_id IS NULL OR v_ellie_id IS NULL THEN
    RAISE EXCEPTION 'Could not find Olivia or Ellie in family_members. Please add them first.';
  END IF;

  -- ============================================
  -- WEEKDAY MORNING ROUTINE (Mon-Fri)
  -- ============================================
  INSERT INTO routines (user_id, title, emoji, type, schedule_type, scheduled_time, points_reward, is_active, sort_order)
  VALUES (v_user_id, 'Morning Routine', '☀️', 'morning', 'weekdays', '07:00', 2, true, 0)
  RETURNING id INTO v_weekday_morning_id;

  -- Weekday Morning Steps
  INSERT INTO routine_steps (routine_id, title, emoji, duration_minutes, sort_order) VALUES
    (v_weekday_morning_id, 'Breakfast', '🥣', 15, 0),
    (v_weekday_morning_id, 'Milk', '🥛', 5, 1),
    (v_weekday_morning_id, 'Diaper Change', '👶', 5, 2),
    (v_weekday_morning_id, 'Get Dressed', '👕', 5, 3),
    (v_weekday_morning_id, 'Boots and Coat On', '🥾', 5, 4);

  -- Assign Olivia and Ellie to weekday morning routine
  INSERT INTO routine_members (routine_id, member_id) VALUES
    (v_weekday_morning_id, v_olivia_id),
    (v_weekday_morning_id, v_ellie_id);

  -- ============================================
  -- WEEKEND MORNING ROUTINE (Sat-Sun)
  -- ============================================
  INSERT INTO routines (user_id, title, emoji, type, schedule_type, scheduled_time, points_reward, is_active, sort_order)
  VALUES (v_user_id, 'Weekend Morning', '🌅', 'morning', 'weekends', '08:30', 2, true, 1)
  RETURNING id INTO v_weekend_morning_id;

  -- Weekend Morning Steps (no boots/coat)
  INSERT INTO routine_steps (routine_id, title, emoji, duration_minutes, sort_order) VALUES
    (v_weekend_morning_id, 'Breakfast', '🥣', 15, 0),
    (v_weekend_morning_id, 'Milk', '🥛', 5, 1),
    (v_weekend_morning_id, 'Diaper Change', '👶', 5, 2),
    (v_weekend_morning_id, 'Get Dressed', '👕', 5, 3);

  -- Assign Olivia and Ellie to weekend morning routine
  INSERT INTO routine_members (routine_id, member_id) VALUES
    (v_weekend_morning_id, v_olivia_id),
    (v_weekend_morning_id, v_ellie_id);

  -- ============================================
  -- BEDTIME ROUTINE (Daily)
  -- ============================================
  INSERT INTO routines (user_id, title, emoji, type, schedule_type, scheduled_time, points_reward, is_active, sort_order)
  VALUES (v_user_id, 'Bedtime Routine', '🌙', 'evening', 'daily', '19:30', 2, true, 2)
  RETURNING id INTO v_bedtime_routine_id;

  -- Bedtime Steps
  INSERT INTO routine_steps (routine_id, title, emoji, duration_minutes, sort_order) VALUES
    (v_bedtime_routine_id, 'Porridge', '🥣', 10, 0),
    (v_bedtime_routine_id, 'Pajamas', '👕', 5, 1),
    (v_bedtime_routine_id, 'Toothbrushing', '🪥', 3, 2),
    (v_bedtime_routine_id, 'Supper Milk', '🥛', 5, 3),
    (v_bedtime_routine_id, 'Kiss & Goodnight', '😘', 2, 4);

  -- Assign Olivia and Ellie to bedtime routine
  INSERT INTO routine_members (routine_id, member_id) VALUES
    (v_bedtime_routine_id, v_olivia_id),
    (v_bedtime_routine_id, v_ellie_id);

  RAISE NOTICE 'Successfully created routines!';
  RAISE NOTICE 'Weekday Morning Routine ID: %', v_weekday_morning_id;
  RAISE NOTICE 'Weekend Morning Routine ID: %', v_weekend_morning_id;
  RAISE NOTICE 'Bedtime Routine ID: %', v_bedtime_routine_id;
END $$;
