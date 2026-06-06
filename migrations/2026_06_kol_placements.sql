-- KOL Management module
-- Apply via Supabase SQL Editor (Dashboard → SQL Editor → New Query → paste → Run)

CREATE TABLE IF NOT EXISTS public.kol_placements (
  id                     text PRIMARY KEY,
  collection_id          text REFERENCES public.collections(id) ON DELETE SET NULL,
  kol_name               text NOT NULL,
  handle                 text,
  platform               text,
  tier                   text,
  followers              integer,
  deliverables           text,
  fee                    numeric,
  payment_status         text DEFAULT 'Not Yet Paid',
  post_date              date,
  brief_url              text,
  post_url               text,
  reach                  integer,
  engagement             integer,
  attributable_orders    integer,
  attributable_revenue   numeric,
  pic                    text,
  status                 text DEFAULT 'Outreach',
  notes                  text,
  added_by               text,
  date_added             date DEFAULT CURRENT_DATE,
  last_updated           timestamptz,
  last_updated_by        text
);

ALTER TABLE public.kol_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_only" ON public.kol_placements FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_kol_collection ON public.kol_placements(collection_id);
CREATE INDEX IF NOT EXISTS idx_kol_status     ON public.kol_placements(status);
CREATE INDEX IF NOT EXISTS idx_kol_platform   ON public.kol_placements(platform);
CREATE INDEX IF NOT EXISTS idx_kol_post_date  ON public.kol_placements(post_date);
