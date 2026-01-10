-- Family Hub: Recurring Events + Extended Contacts Enhancement
-- Run this migration in Supabase SQL Editor
-- Adds: contact_member_links, event_contacts tables
-- Alters: contacts and family_members to add photo_url

-- ============================================
-- CONTACT MEMBER LINKS (link contacts to board members)
-- ============================================
-- Example: "Grandma Rose" linked to "Olivia" as "Mormor"
CREATE TABLE IF NOT EXISTS contact_member_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,  -- User-defined: "Mormor", "Grandma", "Uncle", etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_id, member_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contact_member_links_contact_id ON contact_member_links(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_member_links_member_id ON contact_member_links(member_id);

-- RLS for contact_member_links
ALTER TABLE contact_member_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contact member links" ON contact_member_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_member_links.contact_id
      AND contacts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert contact member links" ON contact_member_links
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_member_links.contact_id
      AND contacts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update contact member links" ON contact_member_links
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_member_links.contact_id
      AND contacts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete contact member links" ON contact_member_links
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_member_links.contact_id
      AND contacts.user_id = auth.uid()
    )
  );

-- ============================================
-- EVENT CONTACTS (tag contacts on calendar events)
-- ============================================
-- Example: "School pickup" event tagged with contact "Mormor"
-- (Board member "Olivia" is tagged via existing event_members table)
CREATE TABLE IF NOT EXISTS event_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, contact_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_contacts_event_id ON event_contacts(event_id);
CREATE INDEX IF NOT EXISTS idx_event_contacts_contact_id ON event_contacts(contact_id);

-- RLS for event_contacts (based on parent event ownership)
ALTER TABLE event_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view event contacts" ON event_contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM calendar_events
      WHERE calendar_events.id = event_contacts.event_id
      AND calendar_events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert event contacts" ON event_contacts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM calendar_events
      WHERE calendar_events.id = event_contacts.event_id
      AND calendar_events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete event contacts" ON event_contacts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM calendar_events
      WHERE calendar_events.id = event_contacts.event_id
      AND calendar_events.user_id = auth.uid()
    )
  );

-- ============================================
-- ADD PHOTO SUPPORT TO CONTACTS
-- ============================================
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- ============================================
-- ADD PHOTO SUPPORT TO FAMILY MEMBERS
-- ============================================
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- ============================================
-- STORAGE BUCKET SETUP NOTES
-- ============================================
-- After running this migration, create storage buckets in Supabase Dashboard:
--
-- 1. Go to Storage in Supabase Dashboard
-- 2. Create bucket "avatars" (for family member photos)
--    - Public bucket: Yes
-- 3. Create bucket "contact-photos" (for contact photos)
--    - Public bucket: Yes
--
-- Storage policies (add in Dashboard > Storage > Policies):
--
-- For "avatars" bucket:
--   INSERT: (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
--   SELECT: (bucket_id = 'avatars')  -- public read
--   DELETE: (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
--
-- For "contact-photos" bucket:
--   INSERT: (bucket_id = 'contact-photos' AND auth.uid()::text = (storage.foldername(name))[1])
--   SELECT: (bucket_id = 'contact-photos')  -- public read
--   DELETE: (bucket_id = 'contact-photos' AND auth.uid()::text = (storage.foldername(name))[1])
