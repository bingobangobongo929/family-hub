-- Family context enhancements
-- Adds aliases and description to family members for AI context

-- Add aliases column (alternative names like "Chelina", "Mum", "Mama")
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}';

-- Add description column (free-form context about the family member)
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS description TEXT;

-- Family context table for overall family information
CREATE TABLE IF NOT EXISTS family_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  context_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE family_context ENABLE ROW LEVEL SECURITY;

-- Users can only access their own family context
CREATE POLICY "Users can view own family context"
  ON family_context FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own family context"
  ON family_context FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own family context"
  ON family_context FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_family_context_user_id ON family_context(user_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_family_context_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER family_context_updated_at
  BEFORE UPDATE ON family_context
  FOR EACH ROW
  EXECUTE FUNCTION update_family_context_updated_at();
