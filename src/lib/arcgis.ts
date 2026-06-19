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

  if (status === "0" || status.includes("proposed") || status.includes("planned")) return "planned";
  if (status.includes("construction") || status.includes("active")) return "active";
  if (status.includes("complete") || status.includes("built")) return "complete";

  return "unknown";
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

async function fetchArcGisFeatures(url: string) {
  const pageSize = 1000;
  const features: ArcGisFeature[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "*",
      returnGeometry: "true",
      outSR: "4326",
      f: "geojson",
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
    });

    const response = await fetch(`${url}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`ArcGIS request failed with ${response.status}`);
    }

    const data = (await response.json()) as ArcGisFeatureCollection;
    const page = data.features ?? [];
    features.push(...page);

    if (page.length < pageSize) break;
  }

  return features;
}

export async function fetchCapitalProjects() {
  const features = await fetchArcGisFeatures(CAPITAL_PROJECTS_URL);
  return features.map(normalizeCapitalProject).filter((feature): feature is FeatureRecord => Boolean(feature));
}

export async function fetchAllArcGisFeatures() {
  return {
    capitalProjects: await fetchCapitalProjects(),
    trailProjects: [] as FeatureRecord[],
    artInstallations: [] as FeatureRecord[],
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
