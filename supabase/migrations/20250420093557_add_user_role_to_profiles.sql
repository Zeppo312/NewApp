-- Add user_role column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_role TEXT;

-- Comment on the column to explain its purpose
COMMENT ON COLUMN profiles.user_role IS 'Indicates whether the user is a mother (mama) or father (papa)';

-- Update existing rows to have a default value if needed
-- This is optional and can be removed if not needed
-- UPDATE profiles SET user_role = 'unknown' WHERE user_role IS NULL;

-- Create an index for faster queries
CREATE INDEX IF NOT EXISTS profiles_user_role_idx ON profiles(user_role);

-- Make sure the RLS policies are updated to include the new column
-- This assumes that there are already policies for the profiles table
-- If not, you might need to create them

-- Example of how to check if a policy exists and create it if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Users can update their own profile'
    ) THEN
        CREATE POLICY "Users can update their own profile" 
        ON profiles 
        FOR UPDATE 
        USING (auth.uid() = id);
    END IF;
END
$$;
