import type { ProjectRecord, Geometry, ProjectStatus, SourceType } from "@/lib/types";
import { cleanSegmentLabels } from "@/lib/enrich";

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
  "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Cultural_and_Society_WebMercator/MapServer/55/query";

// ─── Regional VA/MD ArcGIS sources ───────────────────────────────────────────
const ARLINGTON_BIKE_URL =
  "https://arlgis.arlingtonva.us/arcgis/rest/services/Open_Data/od_Bike_Route_Lines/FeatureServer/0/query";
const ALEXANDRIA_BIKE_URL =
  "https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/TRANSPORTATION_bicycle_facilities/FeatureServer/0/query";
const FAIRFAX_BIKE_URL =
  "https://www.fairfaxcounty.gov/gispub2/rest/services/FCDOT/Transportation/MapServer/38/query";
// VDOT/MDOT are statewide — always use DC_METRO_BBOX to limit features
const VDOT_BIKE_URL =
  "https://services1.arcgis.com/ew4gfvr0tWZCLwst/arcgis/rest/services/VDOTBicycleFacilities/FeatureServer/0/query";
const MONTGOMERY_BIKE_URL =
  "https://services1.arcgis.com/yonFSo6pHqSswPro/arcgis/rest/services/Bikeways/FeatureServer/0/query";
const PGCOUNTY_BIKE_URL =
  "https://gisonline.princegeorgescountymd.gov/arcgis/rest/services/DPWT/BikeLaneInventory/MapServer/0/query";
const MDOT_BIKE_URL =
  "https://geodata.md.gov/imap/rest/services/Transportation/MD_BikewayNetworks/FeatureServer/0/query";

// Bounding box limiting VDOT/MDOT statewide datasets to the DC metro area
const DC_METRO_BBOX: [number, number, number, number] = [-78, 38.5, -76.5, 39.5];

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

function pick(raw: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (raw[key] !== null && raw[key] !== undefined && raw[key] !== "") return raw[key];
  }
  return null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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

function normalizeCapitalProject(feature: ArcGisFeature): ProjectRecord | null {
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
    jurisdiction: null,
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

function normalizeBikeLane(feature: ArcGisFeature): ProjectRecord | null {
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
  const slug = slugify(project?.trim() || routeName || objectId);

  return {
    id: `bike-lane-${slug}`,
    source_type: "bike_lane",
    source_id: objectId,
    name,
    status: normalizeStatus(raw.ProjectWorkStatus),
    ward: null,
    jurisdiction: "dc",
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

function normalizeExistingTrail(feature: ArcGisFeature): ProjectRecord | null {
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
    jurisdiction: null,
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

function normalizePlannedTrail(feature: ArcGisFeature): ProjectRecord | null {
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
    jurisdiction: null,
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

function normalizePublicArt(feature: ArcGisFeature): ProjectRecord | null {
  const raw = feature.properties;
  const objectId = asString(pick(raw, "OBJECTID", "DCGIS.PLACE_NAMES_PT.OBJECTID"));
  const name = asString(pick(raw, "TITLE", "ARTWORKNAME", "DCGIS.PLACE_NAMES_PT.NAME"));

  if (!objectId || !name || !feature.geometry) return null;

  const artist = asString(raw.ARTIST);
  const medium = asString(raw.MEDIUM) ?? asString(raw.ARTWORKTYPE);
  const category = asString(pick(raw, "MAR.VW_PLACE_NAME_CATEGORIES.CATEGORY"));
  const location = asString(pick(raw, "LOCATION", "SUBLOCALITY", "DCGIS.ADDRESSES_PT.ADDRESS"));
  const descParts = [
    artist ? `By ${artist}.` : null,
    medium ?? category,
    location ? `Located at ${location}.` : null,
  ].filter(Boolean);

  return {
    id: `art-installation-${objectId}`,
    source_type: "art_installation",
    source_id: objectId,
    name,
    status: normalizeStatus(pick(raw, "STATUS", "DCGIS.PLACE_NAMES_PT.STATUS")),
    ward: asString(pick(raw, "WARD", "DCGIS.ADDRESSES_PT.WARD"))?.replace(/^Ward\s+/i, "") ?? null,
    jurisdiction: null,
    mode: medium ?? "Public art",
    description: descParts.length ? descParts.join(" ") : asString(raw.DESCRIPTION),
    timeline_start: raw.YEARINSTALLED ? `${asString(raw.YEARINSTALLED)}-01-01` : asDate(pick(raw, "CREATED_DATE", "DCGIS.PLACE_NAMES_PT.CREATED_DATE")),
    timeline_end: null,
    cost: null,
    official_url: asString(raw.URL),
    geometry: feature.geometry,
    raw,
    synced_at: new Date().toISOString(),
  };
}

async function fetchArcGisFeatures(
  url: string,
  options: { paginate?: boolean; bbox?: [number, number, number, number] } = {},
) {
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

    if (options.bbox) {
      const [xmin, ymin, xmax, ymax] = options.bbox;
      params.set("geometry", JSON.stringify({ xmin, ymin, xmax, ymax, spatialReference: { wkid: 4326 } }));
      params.set("geometryType", "esriGeometryEnvelope");
      params.set("spatialRel", "esriSpatialRelIntersects");
      params.set("inSR", "4326");
    }

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
  return features.map(normalizeCapitalProject).filter((feature): feature is ProjectRecord => Boolean(feature));
}

export async function fetchBikeLanes(options: { labelLimit?: number } = {}) {
  const features = await fetchArcGisFeatures(BIKE_LANES_URL, { paginate: true });

  // The ArcGIS layer stores one record per physical segment. Group by Project
  // (falling back to RouteName) so a 3-mile project becomes a single record
  // with a merged MultiLineString geometry instead of dozens of short stubs.
  const groups = new Map<string, ArcGisFeature[]>();
  for (const feature of features) {
    const raw = feature.properties;
    const projectKey =
      asString(raw.Project)?.trim() ||
      asString(raw.RouteName)?.trim() ||
      asString(raw.ObjectID) ||
      "unknown";
    const key = slugify(projectKey);
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

    // Store per-segment breakdown so the modal can show "sharrow on blocks X–Y"
    const segments = bucket.map((f) => ({
      facility: asString(f.properties.Facility) ?? asString(f.properties.Asset),
      label: asString(f.properties.Label),
      coordinates:
        f.geometry?.type === "LineString"
          ? (f.geometry.coordinates as [number, number][])
          : f.geometry?.type === "MultiLineString"
            ? (f.geometry.coordinates as [number, number][][]).flat()
            : ([] as [number, number][]),
    }));

    merged.push({
      geometry: lines.length > 0 ? { type: "MultiLineString", coordinates: lines } : bucket[0].geometry,
      properties: {
        ...bucket[0].properties,
        Facility: facilities.length ? facilities.join(", ") : bucket[0].properties.Facility,
        _segments: segments,
      },
    });
  }

  // Clean segment labels to human-readable form (ALL CAPS → title case, etc.)
  const rawLabels = merged.flatMap((f) => {
    const segs = f.properties._segments as Array<{ label: string | null }> | undefined;
    return segs ? segs.map((s) => s.label).filter((l): l is string => l !== null) : [];
  });
  const labelsToClean = options.labelLimit != null ? rawLabels.slice(0, options.labelLimit) : rawLabels;
  const cleanedLabels = await cleanSegmentLabels(labelsToClean);
  if (cleanedLabels.size) {
    for (const f of merged) {
      const segs = f.properties._segments as Array<{ facility: string | null; label: string | null; coordinates: [number, number][] }> | undefined;
      if (segs) {
        f.properties._segments = segs.map((s) => ({
          ...s,
          label: s.label ? (cleanedLabels.get(s.label) ?? s.label) : null,
        }));
      }
    }
  }

  return merged.map(normalizeBikeLane).filter((feature): feature is ProjectRecord => Boolean(feature));
}

export async function fetchTrailProjects() {
  const [existingTrails, plannedTrails] = await Promise.all([
    fetchArcGisFeatures(EXISTING_BIKE_TRAILS_URL, { paginate: false }),
    fetchArcGisFeatures(PLANNED_MULTI_USE_TRAILS_URL, { paginate: false }),
  ]);

  return [
    ...existingTrails.map(normalizeExistingTrail),
    ...plannedTrails.map(normalizePlannedTrail),
  ].filter((feature): feature is ProjectRecord => Boolean(feature));
}

export async function fetchArtInstallations() {
  const features = await fetchArcGisFeatures(PUBLIC_ART_URL, { paginate: false });
  return features.map(normalizePublicArt).filter((feature): feature is ProjectRecord => Boolean(feature));
}

// ─── Regional VA/MD normalize helpers ────────────────────────────────────────

function makeRegionalBikeLane(
  jurisdiction: string,
  idPrefix: string,
  feature: ArcGisFeature,
): ProjectRecord | null {
  const raw = feature.properties;
  const objectId = asString(pick(raw, "OBJECTID", "ObjectID", "FID"));
  const name =
    asString(pick(raw, "STREETNAME", "StreetName", "STREET_NAME", "ROUTE_NAME", "RouteName", "ROUTE_NM", "NAME")) ??
    `${jurisdiction}-${objectId}`;

  if (!objectId || !feature.geometry) return null;

  const facilityRaw = asString(
    pick(raw, "BIKEFACILITY", "FACILITY_TYPE", "FacilityType", "BIKELANE_TYPE", "LaneType", "BIKEWAY_TYPE", "BIKEWAYTYPE", "Facility", "FACILITYTYPE"),
  );
  const statusRaw = asString(pick(raw, "STATUS", "Status", "BIKESTATUS", "CONDITION"));

  return {
    id: `${idPrefix}-${objectId}`,
    source_type: "bike_lane",
    source_id: `${jurisdiction}-${objectId}`,
    name,
    status: normalizeStatus(statusRaw ?? "existing"),
    ward: null,
    jurisdiction,
    mode: facilityRaw,
    description: null,
    timeline_start: null,
    timeline_end: null,
    cost: null,
    official_url: null,
    geometry: feature.geometry,
    raw,
    synced_at: new Date().toISOString(),
  };
}

export async function fetchArlingtonBikeLanes(): Promise<ProjectRecord[]> {
  const features = await fetchArcGisFeatures(ARLINGTON_BIKE_URL);
  return features
    .map((f) => makeRegionalBikeLane("arlington", "arlington", f))
    .filter((r): r is ProjectRecord => r !== null);
}

export async function fetchAlexandriaBikeLanes(): Promise<ProjectRecord[]> {
  const features = await fetchArcGisFeatures(ALEXANDRIA_BIKE_URL);
  return features
    .map((f) => makeRegionalBikeLane("alexandria", "alexandria", f))
    .filter((r): r is ProjectRecord => r !== null);
}

export async function fetchFairfaxBikeLanes(): Promise<ProjectRecord[]> {
  const features = await fetchArcGisFeatures(FAIRFAX_BIKE_URL);
  return features
    .map((f) => makeRegionalBikeLane("fairfax", "fairfax", f))
    .filter((r): r is ProjectRecord => r !== null);
}

export async function fetchVdotBikeLanes(): Promise<ProjectRecord[]> {
  const features = await fetchArcGisFeatures(VDOT_BIKE_URL, { bbox: DC_METRO_BBOX });
  return features
    .map((f) => makeRegionalBikeLane("vdot", "vdot", f))
    .filter((r): r is ProjectRecord => r !== null);
}

export async function fetchMontgomeryBikeLanes(): Promise<ProjectRecord[]> {
  const features = await fetchArcGisFeatures(MONTGOMERY_BIKE_URL);
  return features
    .map((f) => makeRegionalBikeLane("montgomery", "montgomery", f))
    .filter((r): r is ProjectRecord => r !== null);
}

export async function fetchPgCountyBikeLanes(): Promise<ProjectRecord[]> {
  const features = await fetchArcGisFeatures(PGCOUNTY_BIKE_URL);
  return features
    .map((f) => makeRegionalBikeLane("pgcounty", "pgcounty", f))
    .filter((r): r is ProjectRecord => r !== null);
}

export async function fetchMdotBikeLanes(): Promise<ProjectRecord[]> {
  const features = await fetchArcGisFeatures(MDOT_BIKE_URL, { bbox: DC_METRO_BBOX });
  return features
    .map((f) => makeRegionalBikeLane("mdot", "mdot", f))
    .filter((r): r is ProjectRecord => r !== null);
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
