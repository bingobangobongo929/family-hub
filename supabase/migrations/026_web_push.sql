-- Add web push subscription support
-- The web_subscription column stores the full subscription JSON for web push

ALTER TABLE push_tokens
  ADD COLUMN IF NOT EXISTS web_subscription JSONB;

-- Update platform check to include 'web'
COMMENT ON COLUMN push_tokens.platform IS 'Platform: ios, android, or web';

-- Add index for platform lookups
CREATE INDEX IF NOT EXISTS idx_push_tokens_platform ON push_tokens(platform);
