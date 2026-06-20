import type { FeatureRecord, Geometry, ProjectStatus, SourceType } from "@/lib/types";

type ArcGisFeature = {
  geometry: Geometry | null;
  properties: Record<string, unknown>;
};

type ArcGisFeatureCollection = {
  features?: ArcGisFeature[];
};

type SyncSourceResult = {
  source_type: SourceType;
  status: "success" | "error";
  records_seen: number;
  records_upserted: number;
  error_message?: string;
};

const CAPITAL_PROJECTS_URL =
  "https://maps2.dcgis.dc.gov/dcgis/rest/services/DDOT/PTP/FeatureServer/0/query";
const BIKE_LANES_URL =
  "https://maps2.dcgis.dc.gov/dcgis/rest/services/DDOT/BikeLane/FeatureServer/0/query";
const EXISTING_BIKE_TRAILS_URL =
  "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Transportation_Bikes_Trails_WebMercator/MapServer/4/query";
const PLANNED_MULTI_USE_TRAILS_URL =
  "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Transportation_Bikes_Trails_WebMercator/MapServer/1/query";
const PUBLIC_ART_URL =
  "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Cultural_and_Society_WebMercator/MapServer/18/query";

function asString(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asDate(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function normalizeStatus(value: unknown): ProjectStatus {
  const status = String(value ?? "").toLowerCase();

  if (
    status === "0" ||
    status.includes("proposed") ||
    status.includes("planned") ||
    status.includes("future")
  ) {
    return "planned";
  }
  if (
    status.includes("construction") ||
    status.includes("active") ||
    status.includes("pending ntp") ||
    status.includes("notice to proceed")
  ) {
    return "active";
  }
  if (status.includes("design") || status.includes("planning")) return "planned";
  if (status.includes("complete") || status.includes("built") || status.includes("existing")) return "complete";

  return "unknown";
}

function pick(raw: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (raw[key] !== null && raw[key] !== undefined && raw[key] !== "") return raw[key];
  }
  return null;
}

function normalizeCapitalProject(feature: ArcGisFeature): FeatureRecord | null {
  const raw = feature.properties;
  const objectId = asString(raw.OBJECTID);
  const name = asString(raw.ProjectName) ?? asString(raw.Label);

  if (!objectId || !name || !feature.geometry) return null;

  return {
    id: `capital-project-${objectId}`,
    source_type: "capital_project",
    source_id: objectId,
    name,
    status: normalizeStatus(raw.Status),
    ward: asString(raw.Ward),
    mode: asString(raw.WorkType),
    description: asString(raw.Description) ?? asString(raw.Label),
    timeline_start: asDate(raw.EstimatedStartDate),
    timeline_end: asDate(raw.EstimatedCompletionDate),
    cost: asNumber(raw.EstimatedCost),
    official_url: null,
    geometry: feature.geometry,
    raw,
    synced_at: new Date().toISOString(),
  };
}

function normalizeBikeLane(feature: ArcGisFeature): FeatureRecord | null {
  const raw = feature.properties;
  const objectId = asString(raw.ObjectID);
  const label = asString(raw.Label);
  const routeName = asString(raw.RouteName);
  const project = asString(raw.Project);
  const name = project?.trim() || label || routeName;

  if (!objectId || !name || !feature.geometry) return null;

  // Use a slug of the project name as the stable ID so that all segments
  // of the same project (which share the same Project field) upsert into
  // one record after merging. Fall back to objectId for unnamed segments.
  const slug = (project?.trim() || routeName || objectId)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return {
    id: `bike-lane-${slug}`,
    source_type: "bike_lane",
    source_id: objectId,
    name,
    status: normalizeStatus(raw.ProjectWorkStatus),
    ward: null,
    mode: asString(raw.Facility) ?? asString(raw.Asset) ?? "Bike lane",
    description: asString(raw.Description) ?? label,
    timeline_start: asDate(raw.CreatedDate),
    timeline_end: asDate(raw.ProjectCompletedDate) ?? asDate(raw.LastUpdatedDate),
    cost: null,
    official_url: asString(raw.ProjectURL),
    geometry: feature.geometry,
    raw,
    synced_at: new Date().toISOString(),
  };
}

function normalizeExistingTrail(feature: ArcGisFeature): FeatureRecord | null {
  const raw = feature.properties;
  const objectId = asString(raw.OBJECTID);
  const name = asString(raw.TRAIL_NAME) ?? asString(raw.NAME);

  if (!objectId || !name || !feature.geometry) return null;

  return {
    id: `trail-existing-${objectId}`,
    source_type: "trail_project",
    source_id: `existing-${objectId}`,
    name,
    status: "complete",
    ward: asString(raw.WARDS),
    mode: asString(raw.TRAIL_CLASS) ?? asString(raw.SURFACE_TYPE) ?? "Trail",
    description: [
      asString(raw.TRAIL_SEGMENT) ? `Segment: ${asString(raw.TRAIL_SEGMENT)}` : null,
      asString(raw.SURFACE_TYPE) ? `Surface: ${asString(raw.SURFACE_TYPE)}` : null,
      asString(raw.MAINTENANCE) ? `Maintained by ${asString(raw.MAINTENANCE)}` : null,
    ]
      .filter(Boolean)
      .join(". "),
    timeline_start: raw.YEAR_CONSTRUCTED ? `${asString(raw.YEAR_CONSTRUCTED)}-01-01` : null,
    timeline_end: null,
    cost: null,
    official_url: null,
    geometry: feature.geometry,
    raw,
    synced_at: new Date().toISOString(),
  };
}

function normalizePlannedTrail(feature: ArcGisFeature): FeatureRecord | null {
  const raw = feature.properties;
  const objectId = asString(raw.OBJECTID);
  const name = asString(raw.TRAIL_NAME) ?? asString(raw.ALETERNATE_NAME);

  if (!objectId || !name || !feature.geometry) return null;

  return {
    id: `trail-planned-${objectId}`,
    source_type: "trail_project",
    source_id: `planned-${objectId}`,
    name,
    status: normalizeStatus(raw.STATUS),
    ward: asString(raw.WARDS),
    mode: asString(raw.USE_TYPE) ?? "Planned multi-use trail",
    description: [
      asString(raw.TRAIL_SEGMENT) ? `Segment: ${asString(raw.TRAIL_SEGMENT)}` : null,
      asNumber(raw.LENGTH) ? `Length: ${Math.round(asNumber(raw.LENGTH) ?? 0).toLocaleString()} ft` : null,
    ]
      .filter(Boolean)
      .join(". "),
    timeline_start: asDate(raw.CREATED_DATE),
    timeline_end: asDate(raw.LAST_EDITED_DATE),
    cost: null,
    official_url: null,
    geometry: feature.geometry,
    raw,
    synced_at: new Date().toISOString(),
  };
}

function normalizePublicArt(feature: ArcGisFeature): FeatureRecord | null {
  const raw = feature.properties;
  const objectId = asString(raw.OBJECTID);
  const name = asString(raw.TITLE) ?? asString(raw.ARTWORKNAME);

  if (!objectId || !name || !feature.geometry) return null;

  const artist = asString(raw.ARTIST);
  const medium = asString(raw.MEDIUM) ?? asString(raw.ARTWORKTYPE);
  const location = asString(raw.LOCATION) ?? asString(raw.SUBLOCALITY);
  const descParts = [
    artist ? `By ${artist}.` : null,
    medium,
    location ? `Located at ${location}.` : null,
  ].filter(Boolean);

  return {
    id: `art-installation-${objectId}`,
    source_type: "art_installation",
    source_id: objectId,
    name,
    status: "complete",
    ward: asString(raw.WARD),
    mode: medium ?? "Public art",
    description: descParts.length ? descParts.join(" ") : asString(raw.DESCRIPTION),
    timeline_start: raw.YEARINSTALLED ? `${asString(raw.YEARINSTALLED)}-01-01` : asDate(raw.CREATED_DATE),
    timeline_end: null,
    cost: null,
    official_url: asString(raw.URL),
    geometry: feature.geometry,
    raw,
    synced_at: new Date().toISOString(),
  };
}

async function fetchArcGisFeatures(url: string, options: { paginate?: boolean } = {}) {
  const paginate = options.paginate ?? true;
  const pageSize = 1000;
  const features: ArcGisFeature[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "*",
      returnGeometry: "true",
      outSR: "4326",
      f: "geojson",
    });

    if (paginate) {
      params.set("resultOffset", String(offset));
      params.set("resultRecordCount", String(pageSize));
    }

    const response = await fetch(`${url}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`ArcGIS request failed with ${response.status}`);
    }

    const data = (await response.json()) as ArcGisFeatureCollection;
    if ("error" in data) {
      throw new Error(JSON.stringify(data.error));
    }

    const page = data.features ?? [];
    features.push(...page);

    if (!paginate || page.length < pageSize) break;
  }

  return features;
}

export async function fetchCapitalProjects() {
  const features = await fetchArcGisFeatures(CAPITAL_PROJECTS_URL);
  return features.map(normalizeCapitalProject).filter((feature): feature is FeatureRecord => Boolean(feature));
}

export async function fetchBikeLanes() {
  const features = await fetchArcGisFeatures(BIKE_LANES_URL, { paginate: true });

  // The ArcGIS layer stores one record per physical segment. Group by Project
  // (falling back to RouteName) so a 3-mile project becomes a single record
  // with a merged MultiLineString geometry instead of dozens of short stubs.
  const groups = new Map<string, ArcGisFeature[]>();
  for (const feature of features) {
    const raw = feature.properties;
    const key =
      asString(raw.Project)?.trim() ||
      asString(raw.RouteName)?.trim() ||
      asString(raw.ObjectID) ||
      "unknown";
    const bucket = groups.get(key) ?? [];
    bucket.push(feature);
    groups.set(key, bucket);
  }

  const merged: ArcGisFeature[] = [];
  for (const [, bucket] of groups) {
    if (bucket.length === 1) {
      merged.push(bucket[0]);
      continue;
    }

    const lines: [number, number][][] = [];
    for (const f of bucket) {
      if (!f.geometry) continue;
      if (f.geometry.type === "LineString") {
        lines.push(f.geometry.coordinates as [number, number][]);
      } else if (f.geometry.type === "MultiLineString") {
        lines.push(...(f.geometry.coordinates as [number, number][][]));
      }
    }

    // Collect unique facility types across segments (e.g. "Protected Bike Lane, Bike Lane")
    const facilities = [
      ...new Set(
        bucket
          .map((f) => asString(f.properties.Facility) ?? asString(f.properties.Asset))
          .filter((v): v is string => v !== null),
      ),
    ];

    merged.push({
      geometry: lines.length > 0 ? { type: "MultiLineString", coordinates: lines } : bucket[0].geometry,
      properties: {
        ...bucket[0].properties,
        Facility: facilities.length ? facilities.join(", ") : bucket[0].properties.Facility,
      },
    });
  }

  return merged.map(normalizeBikeLane).filter((feature): feature is FeatureRecord => Boolean(feature));
}

export async function fetchTrailProjects() {
  const [existingTrails, plannedTrails] = await Promise.all([
    fetchArcGisFeatures(EXISTING_BIKE_TRAILS_URL, { paginate: false }),
    fetchArcGisFeatures(PLANNED_MULTI_USE_TRAILS_URL, { paginate: false }),
  ]);

  return [
    ...existingTrails.map(normalizeExistingTrail),
    ...plannedTrails.map(normalizePlannedTrail),
  ].filter((feature): feature is FeatureRecord => Boolean(feature));
}

export async function fetchArtInstallations() {
  const features = await fetchArcGisFeatures(PUBLIC_ART_URL, { paginate: true });
  return features.map(normalizePublicArt).filter((feature): feature is FeatureRecord => Boolean(feature));
}

export async function fetchAllArcGisFeatures() {
  return {
    capitalProjects: await fetchCapitalProjects(),
    bikeLanes: await fetchBikeLanes(),
    trailProjects: await fetchTrailProjects(),
    artInstallations: await fetchArtInstallations(),
  };
}

export async function summarizeSource<T>(
  source_type: SourceType,
  work: () => Promise<T[]>,
): Promise<SyncSourceResult & { records?: T[] }> {
  try {
    const records = await work();
    return {
      source_type,
      status: "success",
      records_seen: records.length,
      records_upserted: records.length,
      records,
    };
  } catch (error) {
    return {
      source_type,
      status: "error",
      records_seen: 0,
      records_upserted: 0,
      error_message: error instanceof Error ? error.message : "Unknown sync error",
    };
  }
}
