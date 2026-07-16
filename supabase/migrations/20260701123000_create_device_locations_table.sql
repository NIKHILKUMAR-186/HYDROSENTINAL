CREATE TABLE IF NOT EXISTS public.device_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL UNIQUE,
  owner_uid TEXT NOT NULL,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
  address TEXT NOT NULL,
  city TEXT,
  district TEXT,
  state TEXT,
  country TEXT,
  postal_code TEXT,
  zone TEXT,
  accuracy DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_locations_owner_uid
  ON public.device_locations (owner_uid);

CREATE INDEX IF NOT EXISTS idx_device_locations_coords
  ON public.device_locations (latitude, longitude);

CREATE OR REPLACE FUNCTION public.set_device_locations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_device_locations_updated_at ON public.device_locations;

CREATE TRIGGER trg_device_locations_updated_at
BEFORE UPDATE ON public.device_locations
FOR EACH ROW
EXECUTE FUNCTION public.set_device_locations_updated_at();
