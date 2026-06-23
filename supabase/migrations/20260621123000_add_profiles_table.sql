CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text,
  role text NOT NULL CHECK (role IN ('user', 'admin')),
  username text UNIQUE,
  full_name text,
  organization_type text,
  organization_name text,
  system_id text,
  reset_code text,
  profile_completion integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX profiles_email_idx ON public.profiles (email);
CREATE INDEX profiles_role_idx ON public.profiles (role);
CREATE INDEX profiles_username_idx ON public.profiles (username);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated' OR auth.uid() = id);
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can insert all profiles" ON public.profiles FOR INSERT WITH CHECK (auth.role() = 'authenticated');
