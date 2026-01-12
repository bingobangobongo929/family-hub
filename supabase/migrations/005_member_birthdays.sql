-- Add date_of_birth to family_members for birthday tracking
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Add index for birthday queries
CREATE INDEX IF NOT EXISTS idx_family_members_dob ON family_members(date_of_birth) WHERE date_of_birth IS NOT NULL;
