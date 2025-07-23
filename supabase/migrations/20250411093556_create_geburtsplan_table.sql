-- Create geburtsplan table
CREATE TABLE IF NOT EXISTS geburtsplan (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set up Row Level Security (RLS)
ALTER TABLE geburtsplan ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Policy for users to view their own geburtsplan
CREATE POLICY "Users can view their own geburtsplan"
  ON geburtsplan
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy for users to insert their own geburtsplan
CREATE POLICY "Users can insert their own geburtsplan"
  ON geburtsplan
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own geburtsplan
CREATE POLICY "Users can update their own geburtsplan"
  ON geburtsplan
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy for users to delete their own geburtsplan
CREATE POLICY "Users can delete their own geburtsplan"
  ON geburtsplan
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX geburtsplan_user_id_idx ON geburtsplan(user_id);