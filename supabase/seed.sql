-- Family Hub Seed Data
-- Run this after creating a user and getting their user_id
-- Replace 'YOUR_USER_ID' with the actual user_id from auth.users

-- To get your user_id, run:
-- SELECT id FROM auth.users WHERE email = 'your-email@example.com';

-- Then replace all instances of 'YOUR_USER_ID' below with that UUID

-- ============================================
-- FAMILY MEMBERS
-- ============================================
INSERT INTO family_members (id, user_id, name, color, role, avatar, points, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111111', 'YOUR_USER_ID', 'Dad', '#3b82f6', 'parent', NULL, 0, 0),
  ('22222222-2222-2222-2222-222222222222', 'YOUR_USER_ID', 'Mum', '#ec4899', 'parent', NULL, 0, 1),
  ('33333333-3333-3333-3333-333333333333', 'YOUR_USER_ID', 'Olivia', '#8b5cf6', 'child', NULL, 47, 2),
  ('44444444-4444-4444-4444-444444444444', 'YOUR_USER_ID', 'Ellie', '#22c55e', 'child', NULL, 23, 3);

-- ============================================
-- CALENDAR EVENTS (This week + some future)
-- ============================================
INSERT INTO calendar_events (user_id, title, description, start_time, end_time, all_day, color, member_id, location) VALUES
  ('YOUR_USER_ID', 'Olivia''s Playgroup', 'Weekly playgroup session', NOW()::date + INTERVAL '10 hours', NOW()::date + INTERVAL '12 hours', FALSE, '#8b5cf6', '33333333-3333-3333-3333-333333333333', 'Community Centre'),
  ('YOUR_USER_ID', 'Ellie''s Nap Time', 'Afternoon nap', NOW()::date + INTERVAL '13 hours', NOW()::date + INTERVAL '15 hours', FALSE, '#22c55e', '44444444-4444-4444-4444-444444444444', 'Home'),
  ('YOUR_USER_ID', 'Family Swim Class', 'Swimming lessons for the kids', (NOW()::date + INTERVAL '1 day') + INTERVAL '9 hours 30 minutes', (NOW()::date + INTERVAL '1 day') + INTERVAL '10 hours 30 minutes', FALSE, '#ec4899', NULL, 'Leisure Centre'),
  ('YOUR_USER_ID', 'Grocery Shopping', 'Weekly shop', (NOW()::date + INTERVAL '2 days') + INTERVAL '10 hours', (NOW()::date + INTERVAL '2 days') + INTERVAL '11 hours 30 minutes', FALSE, '#3b82f6', '11111111-1111-1111-1111-111111111111', 'Tesco'),
  ('YOUR_USER_ID', 'Health Visitor', 'Ellie''s checkup', (NOW()::date + INTERVAL '3 days') + INTERVAL '10 hours', (NOW()::date + INTERVAL '3 days') + INTERVAL '10 hours 30 minutes', FALSE, '#22c55e', '44444444-4444-4444-4444-444444444444', 'Home'),
  ('YOUR_USER_ID', 'Olivia''s Birthday Party', 'Third birthday celebration!', (NOW()::date + INTERVAL '5 days') + INTERVAL '14 hours', (NOW()::date + INTERVAL '5 days') + INTERVAL '17 hours', FALSE, '#8b5cf6', '33333333-3333-3333-3333-333333333333', 'Home'),
  ('YOUR_USER_ID', 'Date Night', 'Dinner reservation', (NOW()::date + INTERVAL '6 days') + INTERVAL '19 hours', (NOW()::date + INTERVAL '6 days') + INTERVAL '22 hours', FALSE, '#f59e0b', NULL, 'The Italian Place'),
  ('YOUR_USER_ID', 'Dentist - Mum', 'Regular checkup', (NOW()::date + INTERVAL '8 days') + INTERVAL '9 hours', (NOW()::date + INTERVAL '8 days') + INTERVAL '9 hours 30 minutes', FALSE, '#ec4899', '22222222-2222-2222-2222-222222222222', 'Dental Surgery'),
  ('YOUR_USER_ID', 'Car Service', 'Annual MOT', (NOW()::date + INTERVAL '10 days'), NULL, TRUE, '#3b82f6', '11111111-1111-1111-1111-111111111111', 'Garage');

-- ============================================
-- CHORES
-- ============================================
INSERT INTO chores (user_id, title, emoji, description, assigned_to, points, due_date, repeat_frequency, repeat_days, status, category, sort_order) VALUES
  ('YOUR_USER_ID', 'Make bed', '🛏️', 'Make your bed neatly', '33333333-3333-3333-3333-333333333333', 2, CURRENT_DATE, 'daily', NULL, 'pending', 'bedroom', 0),
  ('YOUR_USER_ID', 'Feed the fish', '🐠', 'Give Bubbles his food', '33333333-3333-3333-3333-333333333333', 3, CURRENT_DATE, 'daily', NULL, 'pending', 'pets', 1),
  ('YOUR_USER_ID', 'Put toys away', '🧸', 'Tidy up toys in living room', '33333333-3333-3333-3333-333333333333', 3, CURRENT_DATE, 'daily', NULL, 'pending', 'tidying', 2),
  ('YOUR_USER_ID', 'Help set table', '🍽️', 'Put out plates and cutlery', '33333333-3333-3333-3333-333333333333', 2, CURRENT_DATE, 'daily', NULL, 'pending', 'meals', 3),
  ('YOUR_USER_ID', 'Water the plants', '🌱', 'Water indoor plants', '33333333-3333-3333-3333-333333333333', 3, CURRENT_DATE, 'weekly', ARRAY[1,4], 'pending', 'gardening', 4),
  ('YOUR_USER_ID', 'Restock nappies', '👶', 'Check and restock nappy supply', '11111111-1111-1111-1111-111111111111', 0, CURRENT_DATE, 'none', NULL, 'pending', 'baby', 5),
  ('YOUR_USER_ID', 'Book GP appointment', '📞', 'Book Ellie''s vaccination', '22222222-2222-2222-2222-222222222222', 0, CURRENT_DATE + INTERVAL '2 days', 'none', NULL, 'pending', 'health', 6),
  ('YOUR_USER_ID', 'Fix baby gate', '🔧', 'Tighten the screws on stair gate', '11111111-1111-1111-1111-111111111111', 0, CURRENT_DATE + INTERVAL '3 days', 'none', NULL, 'pending', 'home', 7);

-- ============================================
-- ROUTINES
-- ============================================
INSERT INTO routines (id, user_id, title, emoji, type, assigned_to, scheduled_time, is_active, sort_order) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'YOUR_USER_ID', 'Morning Routine', '🌅', 'morning', NULL, '07:00:00', TRUE, 0),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'YOUR_USER_ID', 'Bedtime Routine', '🌙', 'evening', NULL, '18:30:00', TRUE, 1);

-- ============================================
-- ROUTINE STEPS
-- ============================================
INSERT INTO routine_steps (routine_id, title, emoji, duration_minutes, sort_order) VALUES
  -- Morning Routine
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Wake up & stretch', '😊', 2, 0),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Get dressed', '👕', 5, 1),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Brush teeth', '🪥', 3, 2),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Eat breakfast', '🥣', 15, 3),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tidy bedroom', '🛏️', 5, 4),
  -- Bedtime Routine
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Tidy toys', '🧸', 10, 0),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Bath time', '🛁', 15, 1),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Put on pyjamas', '👚', 5, 2),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Brush teeth', '🪥', 3, 3),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Bedtime story', '📖', 10, 4),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Goodnight kisses', '😘', 2, 5);

-- ============================================
-- REWARDS (Prize Vault)
-- ============================================
INSERT INTO rewards (user_id, title, emoji, description, point_cost, is_active) VALUES
  ('YOUR_USER_ID', 'Extra Screen Time', '📱', '30 minutes extra tablet time', 10, TRUE),
  ('YOUR_USER_ID', 'Movie Night Pick', '🎬', 'Choose the family movie', 15, TRUE),
  ('YOUR_USER_ID', 'Ice Cream Trip', '🍦', 'Trip to the ice cream shop', 25, TRUE),
  ('YOUR_USER_ID', 'New Sticker Pack', '⭐', 'Pick a new sticker pack', 20, TRUE),
  ('YOUR_USER_ID', 'Stay Up Late', '🌙', 'Stay up 30 minutes past bedtime', 30, TRUE),
  ('YOUR_USER_ID', 'Trip to the Park', '🎢', 'Special outing to the adventure park', 50, TRUE);

-- ============================================
-- NOTES (Family Pinboard)
-- ============================================
INSERT INTO notes (user_id, title, content, color, pinned, author_id) VALUES
  ('YOUR_USER_ID', 'Birthday Party', 'Olivia''s 3rd birthday party on Saturday - cake ordered from bakery!', '#fef3c7', TRUE, '22222222-2222-2222-2222-222222222222'),
  ('YOUR_USER_ID', 'Health Visitor', 'Health visitor coming Thursday 10am', '#dbeafe', TRUE, '11111111-1111-1111-1111-111111111111'),
  ('YOUR_USER_ID', 'Grocery List', 'Don''t forget: milk, bread, bananas, yogurt', '#dcfce7', FALSE, '22222222-2222-2222-2222-222222222222'),
  ('YOUR_USER_ID', 'Emergency Numbers', 'GP: 0161 xxx xxxx\nNHS: 111\nDentist: 0161 xxx xxxx', '#fce7f3', TRUE, NULL),
  ('YOUR_USER_ID', 'WiFi Password', 'Guest WiFi: FamilyHub2024', '#e0e7ff', FALSE, '11111111-1111-1111-1111-111111111111');

-- ============================================
-- DASHBOARD PAGE (Default)
-- ============================================
INSERT INTO dashboard_pages (id, user_id, name, sort_order) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'YOUR_USER_ID', 'Home', 0);

-- ============================================
-- DASHBOARD WIDGETS (Default Layout)
-- ============================================
INSERT INTO dashboard_widgets (page_id, widget_type, title, config, layout_lg, layout_md, layout_sm) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'clock', 'Clock', '{}', '{"x": 0, "y": 0, "w": 2, "h": 2}', '{"x": 0, "y": 0, "w": 2, "h": 2}', '{"x": 0, "y": 0, "w": 2, "h": 2}'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'weather', 'Weather', '{"location": "Manchester"}', '{"x": 2, "y": 0, "w": 2, "h": 2}', '{"x": 2, "y": 0, "w": 2, "h": 2}', '{"x": 0, "y": 2, "w": 2, "h": 2}'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'schedule', 'Today', '{}', '{"x": 4, "y": 0, "w": 2, "h": 4}', '{"x": 0, "y": 2, "w": 4, "h": 3}', '{"x": 0, "y": 4, "w": 2, "h": 3}'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'chores', 'Chores', '{}', '{"x": 0, "y": 2, "w": 2, "h": 3}', '{"x": 0, "y": 5, "w": 2, "h": 3}', '{"x": 0, "y": 7, "w": 2, "h": 3}'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'routines', 'Routines', '{}', '{"x": 2, "y": 2, "w": 2, "h": 3}', '{"x": 2, "y": 5, "w": 2, "h": 3}', '{"x": 0, "y": 10, "w": 2, "h": 3}'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'rewards', 'Stars', '{}', '{"x": 4, "y": 4, "w": 2, "h": 2}', '{"x": 0, "y": 8, "w": 2, "h": 2}', '{"x": 0, "y": 13, "w": 2, "h": 2}');

-- ============================================
-- APP SETTINGS (Defaults)
-- ============================================
INSERT INTO app_settings (user_id, key, value) VALUES
  ('YOUR_USER_ID', 'theme', '"light"'),
  ('YOUR_USER_ID', 'screensaver_enabled', 'true'),
  ('YOUR_USER_ID', 'screensaver_timeout', '300'),
  ('YOUR_USER_ID', 'screensaver_mode', '"clock"'),
  ('YOUR_USER_ID', 'sleep_start', '"22:00"'),
  ('YOUR_USER_ID', 'sleep_end', '"06:00"'),
  ('YOUR_USER_ID', 'weather_location', '"Manchester, UK"'),
  ('YOUR_USER_ID', 'weather_unit', '"celsius"');
