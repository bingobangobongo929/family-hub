-- Widget layouts table for cross-device sync
-- Stores user's dashboard widget configuration

CREATE TABLE IF NOT EXISTS widget_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  active_widgets TEXT[] NOT NULL DEFAULT ARRAY['clock', 'weather', 'countdown', 'schedule', 'chores', 'stars', 'quickactions'],
  layouts JSONB NOT NULL DEFAULT '{"lg": []}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE widget_layouts ENABLE ROW LEVEL SECURITY;

-- Users can only access their own layout
CREATE POLICY "Users can view own widget layout"
  ON widget_layouts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own widget layout"
  ON widget_layouts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own widget layout"
  ON widget_layouts FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_widget_layouts_user_id ON widget_layouts(user_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_widget_layouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER widget_layouts_updated_at
  BEFORE UPDATE ON widget_layouts
  FOR EACH ROW
  EXECUTE FUNCTION update_widget_layouts_updated_at();
