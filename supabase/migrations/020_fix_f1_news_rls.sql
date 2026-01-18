-- Migration: Fix f1_news_articles RLS policies
-- The "Service can manage f1 news" policy was too permissive (allowed any user to write)
-- Service role bypasses RLS, so we don't need a policy for server-side writes

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service can manage f1 news" ON f1_news_articles;

-- Keep only the public read policy (already exists, but re-create to be safe)
DROP POLICY IF EXISTS "Anyone can read f1 news" ON f1_news_articles;
CREATE POLICY "Anyone can read f1 news"
  ON f1_news_articles FOR SELECT
  USING (true);

-- Note: Server-side operations use SUPABASE_SERVICE_ROLE_KEY which bypasses RLS entirely
-- No additional policy needed for writes - only the server can write
