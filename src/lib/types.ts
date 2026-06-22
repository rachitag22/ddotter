export type SourceType = "capital_project" | "bike_lane" | "trail_project" | "art_installation";
export type ProjectStatus = "active" | "planned" | "complete" | "unknown";

export type Geometry =
  | { type: "Point"; coordinates: [number, number] }
  | { type: "LineString"; coordinates: [number, number][] }
  | { type: "MultiLineString"; coordinates: [number, number][][] };

export type ProjectRecord = {
  id: string;
  source_type: SourceType;
  source_id: string;
  name: string;
  status: ProjectStatus;
  ward: string | null;
  mode: string | null;
  description: string | null;
  timeline_start: string | null;
  timeline_end: string | null;
  cost: number | null;
  official_url: string | null;
  geometry: Geometry;
  raw: Record<string, unknown>;
  synced_at: string;
  last_enrichment_attempted_at?: string | null;
  last_enriched_at?: string | null;
  enrichment_error?: string | null;
  feedback_count?: number;
  support_count?: number;
  support_percent?: number;
};

export type ProjectFilters = {
  type?: string;
  ward?: string;
  status?: string;
  q?: string;
};

// Slim projection used in the drawer list — excludes raw ArcGIS JSON and
// geometry coordinates which are only needed by the map renderer.
export type ListProjectRecord = Omit<ProjectRecord, "raw" | "geometry">;

export type FeedbackPayload = {
  support: boolean;
  comment: string;
  name?: string;
  email?: string;
};
