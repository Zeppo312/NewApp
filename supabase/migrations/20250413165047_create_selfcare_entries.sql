-- Create selfcare_entries table
CREATE TABLE IF NOT EXISTS selfcare_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  mood TEXT,
  journal_entry TEXT,
  sleep_hours SMALLINT,
  water_intake SMALLINT,
  exercise_done BOOLEAN DEFAULT FALSE,
  selfcare_activities TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS selfcare_entries_user_id_idx ON selfcare_entries(user_id);
CREATE INDEX IF NOT EXISTS selfcare_entries_date_idx ON selfcare_entries(date);

-- Set up RLS (Row Level Security)
ALTER TABLE selfcare_entries ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Users can only view their own entries
CREATE POLICY "Users can view their own selfcare entries"
  ON selfcare_entries
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own entries
CREATE POLICY "Users can insert their own selfcare entries"
  ON selfcare_entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own entries
CREATE POLICY "Users can update their own selfcare entries"
  ON selfcare_entries
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only delete their own entries
CREATE POLICY "Users can delete their own selfcare entries"
  ON selfcare_entries
  FOR DELETE
  USING (auth.uid() = user_id);