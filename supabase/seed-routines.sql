-- Seed Routines for Family Hub
-- Run this SQL in Supabase SQL Editor after logging in
-- This creates the Bedtime and Morning routines with steps for your children

-- First, let's get the user_id (assumes you're the only user or modify the email)
-- Replace 'your-email@example.com' with your actual email if needed
DO $$
DECLARE
  v_user_id UUID;
  v_olivia_id UUID;
  v_ellie_id UUID;
  v_bedtime_routine_id UUID;
  v_morning_routine_id UUID;
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
  -- BEDTIME ROUTINE
  -- ============================================
  INSERT INTO routines (user_id, title, emoji, type, scheduled_time, points_reward, is_active, sort_order)
  VALUES (v_user_id, 'Bedtime Routine', '🌙', 'evening', '19:30', 2, true, 0)
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

  -- ============================================
  -- MORNING ROUTINE
  -- ============================================
  INSERT INTO routines (user_id, title, emoji, type, scheduled_time, points_reward, is_active, sort_order)
  VALUES (v_user_id, 'Morning Routine', '☀️', 'morning', '07:00', 2, true, 1)
  RETURNING id INTO v_morning_routine_id;

  -- Morning Steps
  INSERT INTO routine_steps (routine_id, title, emoji, duration_minutes, sort_order) VALUES
    (v_morning_routine_id, 'Get dressed', '👕', 5, 0),
    (v_morning_routine_id, 'Brush teeth', '🪥', 3, 1),
    (v_morning_routine_id, 'Eat breakfast', '🥣', 15, 2),
    (v_morning_routine_id, 'Tidy bedroom', '🛏️', 5, 3);

  -- Assign Olivia and Ellie to morning routine
  INSERT INTO routine_members (routine_id, member_id) VALUES
    (v_morning_routine_id, v_olivia_id),
    (v_morning_routine_id, v_ellie_id);

  RAISE NOTICE 'Successfully created routines!';
  RAISE NOTICE 'Bedtime Routine ID: %', v_bedtime_routine_id;
  RAISE NOTICE 'Morning Routine ID: %', v_morning_routine_id;
END $$;
