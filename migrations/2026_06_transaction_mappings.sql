-- Transaction Mapping module
-- Apply via Supabase SQL Editor (Dashboard → SQL Editor → New Query → paste → Run)
--
-- Loose join: salesorder_id refs jubelio_sales_orders but we don't enforce FK
-- because jubelio_sales_orders is sync'd from external source and rows can
-- disappear/reappear. A loose link is safer.

CREATE TABLE IF NOT EXISTS public.transaction_mappings (
  salesorder_id     bigint PRIMARY KEY,
  category          text,
  project_ref       text,
  notes             text,
  mapped_by         text,
  mapped_at         timestamptz,
  last_updated      timestamptz,
  last_updated_by   text
);

ALTER TABLE public.transaction_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_only" ON public.transaction_mappings FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_txmap_category    ON public.transaction_mappings(category);
CREATE INDEX IF NOT EXISTS idx_txmap_project_ref ON public.transaction_mappings(project_ref);
CREATE INDEX IF NOT EXISTS idx_txmap_mapped_at   ON public.transaction_mappings(mapped_at DESC);
