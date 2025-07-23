-- Baby-Informationen
CREATE TABLE IF NOT EXISTS baby_info (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  birth_date TIMESTAMP WITH TIME ZONE,
  weight TEXT,
  height TEXT,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Tagebucheinträge
CREATE TABLE IF NOT EXISTS baby_diary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  mood TEXT,
  content TEXT,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alltags-Tracking
CREATE TABLE IF NOT EXISTS baby_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  entry_type TEXT, -- 'diaper', 'sleep', 'feeding', etc.
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security für baby_info
ALTER TABLE baby_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own baby info" ON baby_info
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own baby info" ON baby_info
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own baby info" ON baby_info
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own baby info" ON baby_info
  FOR DELETE USING (auth.uid() = user_id);

-- Row Level Security für baby_diary
ALTER TABLE baby_diary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own diary entries" ON baby_diary
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own diary entries" ON baby_diary
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own diary entries" ON baby_diary
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own diary entries" ON baby_diary
  FOR DELETE USING (auth.uid() = user_id);

-- Row Level Security für baby_daily
ALTER TABLE baby_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily entries" ON baby_daily
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily entries" ON baby_daily
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily entries" ON baby_daily
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily entries" ON baby_daily
  FOR DELETE USING (auth.uid() = user_id);
