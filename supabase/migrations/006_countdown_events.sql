-- Family Hub: Countdown Events + Birthday Tracking Toggle
-- Run this migration in Supabase SQL Editor
-- Adds: countdown_events table, contacts.show_birthday_countdown column

-- ============================================
-- COUNTDOWN EVENTS TABLE
-- ============================================
-- Stores custom events/holidays for the countdown widget
CREATE TABLE IF NOT EXISTS countdown_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📅',
  event_type TEXT NOT NULL DEFAULT 'holiday'
    CHECK (event_type IN ('holiday', 'event', 'trip', 'school', 'other')),
  is_recurring BOOLEAN NOT NULL DEFAULT true,  -- Repeats annually
  is_active BOOLEAN NOT NULL DEFAULT true,     -- Can be disabled without deleting
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_countdown_events_user_id ON countdown_events(user_id);
CREATE INDEX IF NOT EXISTS idx_countdown_events_date ON countdown_events(date);
CREATE INDEX IF NOT EXISTS idx_countdown_events_active ON countdown_events(is_active) WHERE is_active = true;

-- RLS for countdown_events
ALTER TABLE countdown_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own countdown events" ON countdown_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own countdown events" ON countdown_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own countdown events" ON countdown_events
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own countdown events" ON countdown_events
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- ADD BIRTHDAY COUNTDOWN TOGGLE TO CONTACTS
-- ============================================
-- When true, this contact's birthday appears in the countdown widget
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS show_birthday_countdown BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- SEED DANISH DEFAULT EVENTS (for new users)
-- ============================================
-- Note: These will be inserted per-user when they first access the countdown settings
-- Here's the reference data for the application to use:

-- Danish Cultural Dates (non-religious, 2026 dates where applicable):
-- Fastelavn: 7 weeks before Easter (Feb 15, 2026) - 🎭
-- Grundlovsdag (Constitution Day): June 5 - 🇩🇰
-- Sankt Hans Aften (Midsummer): June 23 - 🔥
-- J-dag (Tuborg Christmas beer): First Friday of November - 🍺
-- Mortensaften: November 10 - 🦆
-- Luciadag: December 13 - 🕯️
-- Juleaften (Christmas Eve): December 24 - 🎄
-- Nytårsaften (New Year's Eve): December 31 - 🎆

-- School Holidays (Denmark):
-- Vinterferie: Week 7 (Feb 9-15, 2026)
-- Påskeferie: Around Easter
-- Sommerferie: Late June - early August
-- Efterårsferie: Week 42 (Oct 12-18, 2026)

-- Other:
-- Valentine's Day: February 14 - 💕
-- Mother's Day: 2nd Sunday of May - 💐
-- Halloween: October 31 - 🎃
