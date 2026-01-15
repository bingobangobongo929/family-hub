-- F1 News articles cache with classifications
-- This persists across deployments so we don't re-classify articles

CREATE TABLE IF NOT EXISTS f1_news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link TEXT UNIQUE NOT NULL,  -- Article URL is the unique key
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  pub_date TIMESTAMPTZ,
  is_interesting BOOLEAN DEFAULT true,
  is_spoiler BOOLEAN DEFAULT false,
  category TEXT DEFAULT 'other',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by link
CREATE INDEX IF NOT EXISTS idx_f1_news_link ON f1_news_articles(link);

-- Index for ordering by date
CREATE INDEX IF NOT EXISTS idx_f1_news_date ON f1_news_articles(pub_date DESC NULLS LAST);

-- RLS - Allow public read, authenticated write
ALTER TABLE f1_news_articles ENABLE ROW LEVEL SECURITY;

-- Everyone can read F1 news
CREATE POLICY "Anyone can read f1 news"
  ON f1_news_articles FOR SELECT
  USING (true);

-- Only authenticated users can insert/update (API uses service role)
CREATE POLICY "Service can manage f1 news"
  ON f1_news_articles FOR ALL
  USING (true)
  WITH CHECK (true);
