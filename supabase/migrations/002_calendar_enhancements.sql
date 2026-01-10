-- Family Hub Calendar Enhancements
-- Run this migration in Supabase SQL Editor
-- Adds: event_categories, event_members, contacts tables
-- Alters: calendar_events to add category_id

-- ============================================
-- EVENT CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS event_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  is_archived BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint per user (only for non-archived)
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_categories_user_name
  ON event_categories(user_id, name)
  WHERE is_archived = FALSE;

-- RLS for event_categories
ALTER TABLE event_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own event categories" ON event_categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own event categories" ON event_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own event categories" ON event_categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own event categories" ON event_categories
  FOR DELETE USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_event_categories_user_id ON event_categories(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_event_categories_updated_at
  BEFORE UPDATE ON event_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- EVENT MEMBERS (Junction Table)
-- ============================================
CREATE TABLE IF NOT EXISTS event_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, member_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_members_event_id ON event_members(event_id);
CREATE INDEX IF NOT EXISTS idx_event_members_member_id ON event_members(member_id);

-- RLS for event_members (based on parent event ownership)
ALTER TABLE event_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view event members" ON event_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM calendar_events
      WHERE calendar_events.id = event_members.event_id
      AND calendar_events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert event members" ON event_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM calendar_events
      WHERE calendar_events.id = event_members.event_id
      AND calendar_events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete event members" ON event_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM calendar_events
      WHERE calendar_events.id = event_members.event_id
      AND calendar_events.user_id = auth.uid()
    )
  );

-- ============================================
-- CONTACTS (for birthdays and external people)
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date_of_birth DATE,
  relationship_group TEXT NOT NULL DEFAULT 'other'
    CHECK (relationship_group IN ('family_us', 'grandparents', 'siblings', 'aunts_uncles', 'cousins', 'friends', 'other')),
  notes TEXT,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_date_of_birth ON contacts(date_of_birth);
CREATE INDEX IF NOT EXISTS idx_contacts_relationship_group ON contacts(relationship_group);

-- RLS for contacts
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contacts" ON contacts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contacts" ON contacts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contacts" ON contacts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contacts" ON contacts
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ALTER CALENDAR_EVENTS (add category_id)
-- ============================================
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES event_categories(id) ON DELETE SET NULL;

-- Index for category lookups
CREATE INDEX IF NOT EXISTS idx_calendar_events_category_id ON calendar_events(category_id);

-- ============================================
-- FUNCTION: Seed default categories for a user
-- ============================================
CREATE OR REPLACE FUNCTION seed_default_categories(p_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO event_categories (user_id, name, emoji, color, sort_order) VALUES
    (p_user_id, 'Doctors/Hospital', '🏥', '#ef4444', 0),
    (p_user_id, 'Guest Daycare', '👶', '#f97316', 1),
    (p_user_id, 'Car Service', '🚗', '#6b7280', 2),
    (p_user_id, 'Birthday', '🎂', '#ec4899', 3),
    (p_user_id, 'School', '🎒', '#3b82f6', 4),
    (p_user_id, 'Activities/Lessons', '🎭', '#8b5cf6', 5),
    (p_user_id, 'Playdates', '🎈', '#22c55e', 6),
    (p_user_id, 'Family Gathering', '👨‍👩‍👧‍👦', '#f59e0b', 7),
    (p_user_id, 'Holiday/Vacation', '✈️', '#06b6d4', 8),
    (p_user_id, 'Work', '💼', '#64748b', 9),
    (p_user_id, 'Pet', '🐾', '#a855f7', 10),
    (p_user_id, 'Home Maintenance', '🔧', '#78716c', 11),
    (p_user_id, 'Reminder', '⏰', '#eab308', 12),
    (p_user_id, 'Misc', '📌', '#94a3b8', 13)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Auto-seed categories for new users
-- ============================================
CREATE OR REPLACE FUNCTION on_auth_user_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM seed_default_categories(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: This trigger should be created in Supabase Dashboard
-- under Database > Triggers, pointing to auth.users table
-- Or run this if you have access:
-- CREATE TRIGGER on_auth_user_created_trigger
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION on_auth_user_created();
