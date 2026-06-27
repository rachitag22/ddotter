-- Add jurisdiction column to scope bike lane records by region
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS jurisdiction text;

-- Backfill existing DC bike lane records so stale-deletion scoping works correctly
UPDATE public.projects SET jurisdiction = 'dc'
WHERE source_type = 'bike_lane' AND jurisdiction IS NULL;

CREATE INDEX IF NOT EXISTS projects_jurisdiction_idx
  ON public.projects (jurisdiction);

CREATE INDEX IF NOT EXISTS projects_bike_lane_jurisdiction_idx
  ON public.projects (source_type, jurisdiction)
  WHERE source_type = 'bike_lane';
