-- Add AI-curated news toggle for F1 notifications
-- When enabled, notifies for ANY article the AI deems interesting (ignores category filters)

ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS f1_news_ai_curated BOOLEAN DEFAULT TRUE;

-- Add comment
COMMENT ON COLUMN notification_preferences.f1_news_ai_curated IS 'When true, notify for all AI-deemed interesting articles regardless of category';
