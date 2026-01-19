-- Migration: Flexible Completion Mode for Routines
-- Date: 2026-01-19
-- Purpose:
--   1. Add completion_mode to routines (sequential vs flexible)
--   2. Add 'manual' schedule type for ad-hoc routines (Going Out, etc.)

-- ============================================
-- 1. ADD COMPLETION MODE TO ROUTINES
-- sequential = must complete in order (good for structure)
-- flexible = complete in any order (good for variable days)
-- ============================================

ALTER TABLE routines ADD COLUMN IF NOT EXISTS completion_mode TEXT DEFAULT 'flexible'
  CHECK (completion_mode IN ('sequential', 'flexible'));

-- ============================================
-- 2. UPDATE SCHEDULE TYPE TO INCLUDE 'manual'
-- Manual routines don't show up automatically - user triggers them
-- ============================================

-- Drop existing constraint and recreate with 'manual' option
ALTER TABLE routines DROP CONSTRAINT IF EXISTS routines_schedule_type_check;
ALTER TABLE routines ADD CONSTRAINT routines_schedule_type_check
  CHECK (schedule_type IN ('daily', 'weekdays', 'weekends', 'custom', 'manual'));

-- ============================================
-- 3. UPDATE HELPER FUNCTION FOR MANUAL ROUTINES
-- ============================================

CREATE OR REPLACE FUNCTION routine_applies_today(
  p_schedule_type TEXT,
  p_schedule_days INTEGER[]
) RETURNS BOOLEAN AS $$
DECLARE
  v_day_of_week INTEGER;
BEGIN
  -- Manual routines never auto-apply - they're triggered manually
  IF p_schedule_type = 'manual' THEN
    RETURN FALSE;
  END IF;

  -- Get current day of week (0 = Sunday, 6 = Saturday)
  v_day_of_week := EXTRACT(DOW FROM CURRENT_DATE);

  CASE p_schedule_type
    WHEN 'daily' THEN
      RETURN TRUE;
    WHEN 'weekdays' THEN
      RETURN v_day_of_week BETWEEN 1 AND 5; -- Mon-Fri
    WHEN 'weekends' THEN
      RETURN v_day_of_week IN (0, 6); -- Sat-Sun
    WHEN 'custom' THEN
      RETURN v_day_of_week = ANY(p_schedule_days);
    ELSE
      RETURN TRUE; -- Default to showing
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 4. INDEX FOR COMPLETION MODE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_routines_completion_mode ON routines(completion_mode);
