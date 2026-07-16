-- Create alerts table
CREATE TABLE public.alerts (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'dismissed')),
  parameter TEXT,
  threshold NUMERIC,
  actual_value NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_alerts_device_id ON public.alerts(device_id);
CREATE INDEX idx_alerts_user_id ON public.alerts(user_id);
CREATE INDEX idx_alerts_status ON public.alerts(status);
CREATE INDEX idx_alerts_created_at ON public.alerts(created_at);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own alerts" ON public.alerts
  FOR SELECT USING (auth.uid()::TEXT = user_id OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()::TEXT) = 'admin');

CREATE POLICY "Users can update own alerts" ON public.alerts
  FOR UPDATE USING (auth.uid()::TEXT = user_id OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()::TEXT) = 'admin');

-- Create complaints table
CREATE TABLE public.complaints (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id TEXT REFERENCES public.devices(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_complaints_user_id ON public.complaints(user_id);
CREATE INDEX idx_complaints_device_id ON public.complaints(device_id);
CREATE INDEX idx_complaints_status ON public.complaints(status);
CREATE INDEX idx_complaints_created_at ON public.complaints(created_at);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own complaints" ON public.complaints
  FOR SELECT USING (auth.uid()::TEXT = user_id OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()::TEXT) = 'admin');

CREATE POLICY "Users can create complaints" ON public.complaints
  FOR INSERT WITH CHECK (auth.uid()::TEXT = user_id);

-- Create device_locations table
CREATE TABLE public.device_locations (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  address TEXT,
  accuracy NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_device_locations_device_id ON public.device_locations(device_id);
CREATE INDEX idx_device_locations_created_at ON public.device_locations(created_at);

ALTER TABLE public.device_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read device locations" ON public.device_locations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.id = device_locations.device_id
      AND (auth.uid()::TEXT = d.owner_uid OR
           (SELECT role FROM public.profiles WHERE id = auth.uid()::TEXT) = 'admin')
    )
  );

-- Create device_readings table (if not using readings table)
CREATE TABLE public.device_readings (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ph NUMERIC,
  tds NUMERIC,
  turbidity NUMERIC,
  temperature NUMERIC,
  status TEXT DEFAULT 'SAFE' CHECK (status IN ('SAFE', 'NOT SAFE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_device_readings_device_id ON public.device_readings(device_id);
CREATE INDEX idx_device_readings_user_id ON public.device_readings(user_id);
CREATE INDEX idx_device_readings_created_at ON public.device_readings(created_at);

ALTER TABLE public.device_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read device readings" ON public.device_readings
  FOR SELECT USING (
    auth.uid()::TEXT = user_id OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()::TEXT) = 'admin'
  );

-- Create notifications table
CREATE TABLE public.notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT USING (auth.uid()::TEXT = user_id);

-- Create login_history table
CREATE TABLE public.login_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  login_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX idx_login_history_user_id ON public.login_history(user_id);
CREATE INDEX idx_login_history_login_time ON public.login_history(login_time);

ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own login history" ON public.login_history
  FOR SELECT USING (auth.uid()::TEXT = user_id OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()::TEXT) = 'admin');

-- Create activities table
CREATE TABLE public.activities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_activities_user_id ON public.activities(user_id);
CREATE INDEX idx_activities_created_at ON public.activities(created_at);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own activities" ON public.activities
  FOR SELECT USING (auth.uid()::TEXT = user_id OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()::TEXT) = 'admin');
