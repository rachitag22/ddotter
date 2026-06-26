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
  jurisdiction: string | null;
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

export type AssetType = "document" | "photo" | "video" | "map" | "link";

export type ProjectAsset = {
  id: string;
  project_id: string;
  asset_type: AssetType;
  url: string;
  title: string | null;
  file_type: string | null;
  scraped_at: string;
};

// ─── Pill filter state ───────────────────────────────────────────────────────

export type PillState = {
  active: boolean;   // show existing bike_network segments (status='existing')
  building: boolean; // show active DDOT projects (status='active')
  planned: boolean;  // show planned DDOT projects (status='planned')
};

// ─── Bike network ────────────────────────────────────────────────────────────

export type BikeNetworkSource =
  | "bike_lane_inventory"
  | "bike_trail"
  | "planned_trail";

export type FacilityType =
  | "protected"
  | "dual_protected"
  | "buffered"
  | "dual_buffered"
  | "conventional"
  | "contraflow"
  | "sharrow"
  | "shared_path"
  | "trail"
  | "unknown";

export type BikeNetworkStatus =
  | "existing"
  | "planned"
  | "under_construction"
  | "future"
  | "complete"
  | "unknown";

export type BikeSegment = {
  id: string;
  source: BikeNetworkSource;
  name: string;
  facility_type: FacilityType;
  status: BikeNetworkStatus;
  ward: string | null;
  length_m: number | null;
  geometry: Geometry;
  raw: Record<string, unknown>;
  synced_at: string;
};
