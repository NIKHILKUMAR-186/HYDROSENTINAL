CREATE TABLE public.readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ph double precision NOT NULL,
  tds double precision NOT NULL,
  turbidity double precision NOT NULL,
  temperature double precision NOT NULL,
  status text NOT NULL CHECK (status IN ('SAFE','NOT SAFE')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX readings_created_at_idx ON public.readings (created_at DESC);

ALTER TABLE public.readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read readings"
  ON public.readings FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert readings"
  ON public.readings FOR INSERT
  WITH CHECK (true);