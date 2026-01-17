-- Seed Routines v2: Scenario-Based Routines for Family Hub
-- Run this SQL in Supabase SQL Editor after running migration 015
-- Creates 6 comprehensive routines for Olivia (3) and Ellie (1)

DO $$
DECLARE
  v_user_id UUID;
  v_olivia_id UUID;
  v_ellie_id UUID;
  -- Routine IDs
  v_morning_id UUID;
  v_bedtime_id UUID;
  v_naptime_id UUID;
  v_leaving_id UUID;
  v_coming_home_id UUID;
  v_mealtime_id UUID;
  -- Scenario IDs for Morning
  v_sc_daycare UUID;
  v_sc_home UUID;
  v_sc_swimming UUID;
  v_sc_grandparents UUID;
  v_sc_sunny UUID;
  -- Scenario IDs for Bedtime
  v_sc_bath_night UUID;
  v_sc_quick_bedtime UUID;
  -- Scenario IDs for Leaving
  v_sc_quick_trip UUID;
  v_sc_full_day UUID;
  v_sc_rainy UUID;
BEGIN
  -- Get the user ID (first user found)
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found. Please login first.';
  END IF;

  -- Get Olivia's ID
  SELECT id INTO v_olivia_id FROM family_members
  WHERE user_id = v_user_id AND LOWER(name) = 'olivia';

  -- Get Ellie's ID
  SELECT id INTO v_ellie_id FROM family_members
  WHERE user_id = v_user_id AND LOWER(name) = 'ellie';

  IF v_olivia_id IS NULL OR v_ellie_id IS NULL THEN
    RAISE EXCEPTION 'Could not find Olivia or Ellie. Please add them first.';
  END IF;

  -- ============================================
  -- 1. MORNING ROUTINE
  -- ============================================
  INSERT INTO routines (user_id, title, emoji, type, scheduled_time, points_reward, is_active, sort_order)
  VALUES (v_user_id, 'Morning Routine', '☀️', 'morning', '07:00', 2, true, 0)
  RETURNING id INTO v_morning_id;

  -- Morning Scenarios
  INSERT INTO routine_scenarios (routine_id, name, emoji, is_going_out, is_default_weekday, is_default_weekend, sort_order)
  VALUES (v_morning_id, 'Daycare', '🏫', true, true, false, 0) RETURNING id INTO v_sc_daycare;

  INSERT INTO routine_scenarios (routine_id, name, emoji, is_going_out, is_default_weekday, is_default_weekend, sort_order)
  VALUES (v_morning_id, 'Home', '🏠', false, false, true, 1) RETURNING id INTO v_sc_home;

  INSERT INTO routine_scenarios (routine_id, name, emoji, is_going_out, is_default_weekday, is_default_weekend, sort_order)
  VALUES (v_morning_id, 'Swimming', '🏊', true, false, false, 2) RETURNING id INTO v_sc_swimming;

  INSERT INTO routine_scenarios (routine_id, name, emoji, is_going_out, is_default_weekday, is_default_weekend, sort_order)
  VALUES (v_morning_id, 'Grandparents', '👵', true, false, false, 3) RETURNING id INTO v_sc_grandparents;

  INSERT INTO routine_scenarios (routine_id, name, emoji, is_going_out, is_default_weekday, is_default_weekend, sort_order)
  VALUES (v_morning_id, 'Sunny Day', '☀️', false, false, false, 4) RETURNING id INTO v_sc_sunny;

  -- Morning Steps
  -- Always show (scenario_ids = NULL)
  INSERT INTO routine_steps (routine_id, title, emoji, duration_minutes, sort_order, scenario_ids, member_ids)
  VALUES
    (v_morning_id, 'Nappy change', '👶', 5, 0, NULL, ARRAY[v_ellie_id]),
    (v_morning_id, 'Potty / toilet', '🚽', 3, 1, NULL, ARRAY[v_olivia_id]),
    (v_morning_id, 'Get dressed', '👕', 5, 2, NULL, NULL),
    (v_morning_id, 'Breakfast', '🥣', 15, 3, NULL, NULL),
    (v_morning_id, 'Brush teeth', '🪥', 3, 4, NULL, NULL),
    (v_morning_id, 'Hair brush', '💇', 2, 5, NULL, NULL),
    (v_morning_id, 'Wash face & hands', '🧼', 2, 6, NULL, NULL);

  -- Going out steps (any scenario with is_going_out = true)
  INSERT INTO routine_steps (routine_id, title, emoji, duration_minutes, sort_order, scenario_ids, member_ids)
  VALUES
    (v_morning_id, 'Shoes on', '👟', 2, 7, ARRAY[v_sc_daycare, v_sc_swimming, v_sc_grandparents], NULL),
    (v_morning_id, 'Coat on', '🧥', 2, 8, ARRAY[v_sc_daycare, v_sc_swimming, v_sc_grandparents], NULL),
    (v_morning_id, 'Pack bag', '🎒', 3, 9, ARRAY[v_sc_daycare], NULL);

  -- Swimming specific
  INSERT INTO routine_steps (routine_id, title, emoji, duration_minutes, sort_order, scenario_ids, member_ids)
  VALUES
    (v_morning_id, 'Swimsuit & towel', '🩱', 3, 10, ARRAY[v_sc_swimming], NULL);

  -- Sunny day specific
  INSERT INTO routine_steps (routine_id, title, emoji, duration_minutes, sort_order, scenario_ids, member_ids)
  VALUES
    (v_morning_id, 'Suncream', '🧴', 3, 11, ARRAY[v_sc_sunny], NULL);

  -- Assign both kids to morning routine
  INSERT INTO routine_members (routine_id, member_id) VALUES
    (v_morning_id, v_olivia_id),
    (v_morning_id, v_ellie_id);

  -- ============================================
  -- 2. BEDTIME ROUTINE
  -- ============================================
  INSERT INTO routines (user_id, title, emoji, type, scheduled_time, points_reward, is_active, sort_order)
  VALUES (v_user_id, 'Bedtime Routine', '🌙', 'evening', '19:30', 2, true, 1)
  RETURNING id INTO v_bedtime_id;

  -- Bedtime Scenarios
  INSERT INTO routine_scenarios (routine_id, name, emoji, is_going_out, is_default_weekday, is_default_weekend, sort_order)
  VALUES (v_bedtime_id, 'Bath Night', '🛁', false, true, true, 0) RETURNING id INTO v_sc_bath_night;

  INSERT INTO routine_scenarios (routine_id, name, emoji, is_going_out, is_default_weekday, is_default_weekend, sort_order)
  VALUES (v_bedtime_id, 'Quick Bedtime', '⚡', false, false, false, 1) RETURNING id INTO v_sc_quick_bedtime;

  -- Bedtime Steps
  INSERT INTO routine_steps (routine_id, title, emoji, duration_minutes, sort_order, scenario_ids, member_ids)
  VALUES
    -- Bath night only
    (v_bedtime_id, 'Bath time', '🛁', 15, 0, ARRAY[v_sc_bath_night], NULL),
    -- Always
    (v_bedtime_id, 'Nappy change', '👶', 5, 1, NULL, ARRAY[v_ellie_id]),
    (v_bedtime_id, 'Potty / toilet', '🚽', 3, 2, NULL, ARRAY[v_olivia_id]),
    (v_bedtime_id, 'Pajamas on', '👕', 3, 3, NULL, NULL),
    (v_bedtime_id, 'Brush teeth', '🪥', 3, 4, NULL, NULL),
    (v_bedtime_id, 'Bedtime milk', '🥛', 5, 5, NULL, NULL),
    (v_bedtime_id, 'Story time', '📖', 10, 6, NULL, NULL),
    (v_bedtime_id, 'Cuddles & kisses', '😘', 2, 7, NULL, NULL),
    (v_bedtime_id, 'Lights out', '💤', 1, 8, NULL, NULL);

  INSERT INTO routine_members (routine_id, member_id) VALUES
    (v_bedtime_id, v_olivia_id),
    (v_bedtime_id, v_ellie_id);

  -- ============================================
  -- 3. NAP TIME (mainly for Ellie)
  -- ============================================
  INSERT INTO routines (user_id, title, emoji, type, scheduled_time, points_reward, is_active, sort_order)
  VALUES (v_user_id, 'Nap Time', '😴', 'custom', '13:00', 1, true, 2)
  RETURNING id INTO v_naptime_id;

  -- No scenarios for nap time - simple routine
  INSERT INTO routine_steps (routine_id, title, emoji, duration_minutes, sort_order, scenario_ids, member_ids)
  VALUES
    (v_naptime_id, 'Nappy check', '👶', 3, 0, NULL, ARRAY[v_ellie_id]),
    (v_naptime_id, 'Milk / bottle', '🍼', 5, 1, NULL, ARRAY[v_ellie_id]),
    (v_naptime_id, 'Quiet time', '🤫', 10, 2, NULL, ARRAY[v_olivia_id]),
    (v_naptime_id, 'Story / song', '🎵', 5, 3, NULL, NULL),
    (v_naptime_id, 'Sleep time', '💤', 1, 4, NULL, ARRAY[v_ellie_id]);

  INSERT INTO routine_members (routine_id, member_id) VALUES
    (v_naptime_id, v_olivia_id),
    (v_naptime_id, v_ellie_id);

  -- ============================================
  -- 4. LEAVING THE HOUSE
  -- ============================================
  INSERT INTO routines (user_id, title, emoji, type, scheduled_time, points_reward, is_active, sort_order)
  VALUES (v_user_id, 'Leaving the House', '🚗', 'custom', NULL, 1, true, 3)
  RETURNING id INTO v_leaving_id;

  -- Leaving Scenarios
  INSERT INTO routine_scenarios (routine_id, name, emoji, is_going_out, is_default_weekday, is_default_weekend, sort_order)
  VALUES (v_leaving_id, 'Quick Trip', '⚡', true, true, true, 0) RETURNING id INTO v_sc_quick_trip;

  INSERT INTO routine_scenarios (routine_id, name, emoji, is_going_out, is_default_weekday, is_default_weekend, sort_order)
  VALUES (v_leaving_id, 'Full Day Out', '📦', true, false, false, 1) RETURNING id INTO v_sc_full_day;

  INSERT INTO routine_scenarios (routine_id, name, emoji, is_going_out, is_default_weekday, is_default_weekend, sort_order)
  VALUES (v_leaving_id, 'Sunny', '☀️', true, false, false, 2) RETURNING id INTO v_sc_sunny;

  INSERT INTO routine_scenarios (routine_id, name, emoji, is_going_out, is_default_weekday, is_default_weekend, sort_order)
  VALUES (v_leaving_id, 'Rainy', '🌧️', true, false, false, 3) RETURNING id INTO v_sc_rainy;

  INSERT INTO routine_steps (routine_id, title, emoji, duration_minutes, sort_order, scenario_ids, member_ids)
  VALUES
    -- Always
    (v_leaving_id, 'Potty / nappy check', '🚽', 3, 0, NULL, NULL),
    (v_leaving_id, 'Shoes on', '👟', 2, 1, NULL, NULL),
    (v_leaving_id, 'Coat on', '🧥', 2, 2, NULL, NULL),
    -- Full day out only
    (v_leaving_id, 'Check bag: snacks', '🍎', 1, 3, ARRAY[v_sc_full_day], NULL),
    (v_leaving_id, 'Check bag: water', '💧', 1, 4, ARRAY[v_sc_full_day], NULL),
    (v_leaving_id, 'Check bag: wipes', '🧻', 1, 5, ARRAY[v_sc_full_day], NULL),
    (v_leaving_id, 'Check bag: change of clothes', '👕', 1, 6, ARRAY[v_sc_full_day], NULL),
    -- Weather specific
    (v_leaving_id, 'Sunhat & suncream', '🧢', 3, 7, ARRAY[v_sc_sunny], NULL),
    (v_leaving_id, 'Rain jacket', '🌂', 2, 8, ARRAY[v_sc_rainy], NULL);

  INSERT INTO routine_members (routine_id, member_id) VALUES
    (v_leaving_id, v_olivia_id),
    (v_leaving_id, v_ellie_id);

  -- ============================================
  -- 5. COMING HOME
  -- ============================================
  INSERT INTO routines (user_id, title, emoji, type, scheduled_time, points_reward, is_active, sort_order)
  VALUES (v_user_id, 'Coming Home', '🏠', 'custom', NULL, 1, true, 4)
  RETURNING id INTO v_coming_home_id;

  -- No scenarios - simple routine
  INSERT INTO routine_steps (routine_id, title, emoji, duration_minutes, sort_order, scenario_ids, member_ids)
  VALUES
    (v_coming_home_id, 'Shoes off', '👟', 1, 0, NULL, NULL),
    (v_coming_home_id, 'Coat off', '🧥', 1, 1, NULL, NULL),
    (v_coming_home_id, 'Wash hands', '🧼', 2, 2, NULL, NULL),
    (v_coming_home_id, 'Unpack bag', '🎒', 2, 3, NULL, NULL);

  INSERT INTO routine_members (routine_id, member_id) VALUES
    (v_coming_home_id, v_olivia_id),
    (v_coming_home_id, v_ellie_id);

  -- ============================================
  -- 6. MEALTIME
  -- ============================================
  INSERT INTO routines (user_id, title, emoji, type, scheduled_time, points_reward, is_active, sort_order)
  VALUES (v_user_id, 'Mealtime', '🍽️', 'custom', NULL, 1, true, 5)
  RETURNING id INTO v_mealtime_id;

  -- No scenarios - simple routine
  INSERT INTO routine_steps (routine_id, title, emoji, duration_minutes, sort_order, scenario_ids, member_ids)
  VALUES
    (v_mealtime_id, 'Wash hands', '🧼', 2, 0, NULL, NULL),
    (v_mealtime_id, 'Bib on', '🍽️', 1, 1, NULL, ARRAY[v_ellie_id]),
    (v_mealtime_id, 'Sit at table', '🪑', 1, 2, NULL, NULL),
    (v_mealtime_id, 'Eat meal', '😋', 15, 3, NULL, NULL),
    (v_mealtime_id, 'Wipe hands & face', '🧻', 2, 4, NULL, NULL),
    (v_mealtime_id, 'Help clear plate', '🍽️', 2, 5, NULL, ARRAY[v_olivia_id]);

  INSERT INTO routine_members (routine_id, member_id) VALUES
    (v_mealtime_id, v_olivia_id),
    (v_mealtime_id, v_ellie_id);

  -- Done!
  RAISE NOTICE '✅ Successfully created 6 routines!';
  RAISE NOTICE '1. Morning Routine (ID: %)', v_morning_id;
  RAISE NOTICE '2. Bedtime Routine (ID: %)', v_bedtime_id;
  RAISE NOTICE '3. Nap Time (ID: %)', v_naptime_id;
  RAISE NOTICE '4. Leaving the House (ID: %)', v_leaving_id;
  RAISE NOTICE '5. Coming Home (ID: %)', v_coming_home_id;
  RAISE NOTICE '6. Mealtime (ID: %)', v_mealtime_id;
END $$;
