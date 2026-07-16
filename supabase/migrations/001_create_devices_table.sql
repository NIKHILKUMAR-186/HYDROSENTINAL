-- Create devices table
CREATE TABLE public.devices (
  id TEXT PRIMARY KEY,
  owner_uid TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unique_id TEXT NOT NULL UNIQUE,
  location TEXT,
  device_type TEXT DEFAULT 'real' CHECK (device_type IN ('simulator', 'real')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  battery NUMERIC,
  address TEXT,
  city TEXT,
  country TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  zone TEXT,
  installation_type TEXT DEFAULT 'manual' CHECK (installation_type IN ('gps', 'manual', 'simulator')),
  is_location_configured BOOLEAN DEFAULT FALSE,
  last_location_update TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_devices_owner_uid ON public.devices(owner_uid);
CREATE INDEX idx_devices_status ON public.devices(status);
CREATE INDEX idx_devices_created_at ON public.devices(created_at);

-- Enable RLS
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own devices
CREATE POLICY "Users can read own devices" ON public.devices
  FOR SELECT USING (auth.uid()::TEXT = owner_uid OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()::TEXT) = 'admin');

-- Allow users to insert their own devices
CREATE POLICY "Users can insert own devices" ON public.devices
  FOR INSERT WITH CHECK (auth.uid()::TEXT = owner_uid);

-- Allow users to update their own devices
CREATE POLICY "Users can update own devices" ON public.devices
  FOR UPDATE USING (auth.uid()::TEXT = owner_uid OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()::TEXT) = 'admin');

-- Allow users to delete their own devices
CREATE POLICY "Users can delete own devices" ON public.devices
  FOR DELETE USING (auth.uid()::TEXT = owner_uid OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()::TEXT) = 'admin');
