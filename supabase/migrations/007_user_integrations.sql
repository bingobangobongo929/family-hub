-- Create user_integrations table for storing OAuth tokens (Google Calendar, Google Photos, etc.)
CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'google_calendar', 'google_photos', etc.
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  provider_user_id TEXT,
  provider_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Enable RLS
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own integrations
CREATE POLICY "Users can view own integrations" ON user_integrations
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own integrations
CREATE POLICY "Users can insert own integrations" ON user_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own integrations
CREATE POLICY "Users can update own integrations" ON user_integrations
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own integrations
CREATE POLICY "Users can delete own integrations" ON user_integrations
  FOR DELETE USING (auth.uid() = user_id);

-- Policy: Service role can do everything (for server-side operations)
CREATE POLICY "Service role full access" ON user_integrations
  FOR ALL USING (auth.role() = 'service_role');

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_provider ON user_integrations(user_id, provider);
