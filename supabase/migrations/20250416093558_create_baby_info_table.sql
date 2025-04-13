-- Erstellen der baby_info-Tabelle
CREATE TABLE IF NOT EXISTS baby_info (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  birth_date TIMESTAMP WITH TIME ZONE,
  gender TEXT,
  height TEXT,
  weight TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Row Level Security für baby_info
ALTER TABLE baby_info ENABLE ROW LEVEL SECURITY;

-- Richtlinien für baby_info
CREATE POLICY "Users can view their own baby info" ON baby_info
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own baby info" ON baby_info
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own baby info" ON baby_info
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own baby info" ON baby_info
  FOR DELETE USING (auth.uid() = user_id);
