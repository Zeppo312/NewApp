-- Add baby_gender column to baby_info table
ALTER TABLE baby_info ADD COLUMN IF NOT EXISTS baby_gender TEXT;

-- Comment on the column to explain its purpose
COMMENT ON COLUMN baby_info.baby_gender IS 'Indicates the gender of the baby (male, female, or unknown)';

-- Create an index for faster queries
CREATE INDEX IF NOT EXISTS baby_info_baby_gender_idx ON baby_info(baby_gender);
