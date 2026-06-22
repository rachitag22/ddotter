import type { BikeSegment, BikeNetworkSource, FacilityType, BikeNetworkStatus, Geometry } from "@/lib/types";

// ─── ArcGIS source URLs ───────────────────────────────────────────────────────

const BIKE_LANE_INVENTORY_URL =
  "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Transportation_Bikes_Trails_WebMercator/MapServer/2/query";
const EXISTING_TRAILS_URL =
  "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Transportation_Bikes_Trails_WebMercator/MapServer/4/query";
const PLANNED_TRAILS_URL =
  "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Transportation_Bikes_Trails_WebMercator/MapServer/1/query";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function asString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// Strip zero-width spaces and normalize whitespace (DDOT data has invisible chars)
function cleanText(value: unknown): string | null {
  const s = asString(value);
  if (!s) return null;
  return s.replace(/[​‌‍﻿]/g, "").trim() || null;
}

type RawFeature = {
  geometry: Geometry | null;
  properties: Record<string, unknown>;
};

async function fetchArcGis(url: string, paginate = true): Promise<RawFeature[]> {
  const pageSize = 1000;
  const features: RawFeature[] = [];

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

    const res = await fetch(`${url}?${params}`);
    if (!res.ok) throw new Error(`ArcGIS ${url} failed with ${res.status}`);

    const data = await res.json();
    if ("error" in data) throw new Error(JSON.stringify(data.error));

    const page: RawFeature[] = (data.features ?? []).map(
      (f: { geometry: Geometry | null; properties?: Record<string, unknown>; attributes?: Record<string, unknown> }) => ({
        geometry: f.geometry ?? null,
        properties: f.properties ?? f.attributes ?? {},
      }),
    );
    features.push(...page);
    if (!paginate || page.length < pageSize) break;
  }

  return features;
}

// ─── Facility type derivation ─────────────────────────────────────────────────

// Layer 2 uses boolean-style fields (non-null value = present, with direction codes)
function facilityFromInventoryFlags(raw: Record<string, unknown>): FacilityType {
  if (raw.BIKELANE_DUAL_PROTECTED) return "dual_protected";
  if (raw.BIKELANE_PROTECTED) return "protected";
  if (raw.BIKELANE_DUAL_BUFFERED) return "dual_buffered";
  if (raw.BIKELANE_BUFFERED) return "buffered";
  if (raw.BIKELANE_CONTRAFLOW) return "contraflow";
  if (raw.BIKELANE_CONVENTIONAL) return "conventional";
  return "unknown";
}

// ─── Status derivation ────────────────────────────────────────────────────────

function trailStatus(value: unknown): BikeNetworkStatus {
  const s = (cleanText(value) ?? "").toLowerCase();
  if (s === "future") return "future";
  if (s.includes("planned") || s.includes("proposed")) return "planned";
  if (s.includes("construction")) return "under_construction";
  return "planned"; // Layer 1 is entirely planned/future
}

// ─── Normalizers ──────────────────────────────────────────────────────────────

function normalizeBikeLaneInventory(f: RawFeature): BikeSegment | null {
  const raw = f.properties;
  const objectId = asString(raw.OBJECTID);
  if (!objectId || !f.geometry) return null;

  const streetName = [asString(raw.STREETNAME), asString(raw.STREETTYPE)].filter(Boolean).join(" ");
  const quadrantMap: Record<number, string> = { 1: "NW", 2: "NE", 3: "SE", 4: "SW" };
  const quad = quadrantMap[Number(raw.QUADRANT)] ?? "";
  const routeName = asString(raw.ROUTENAME);
  const name = [routeName ?? streetName, quad].filter(Boolean).join(" ");

  return {
    id: `bike-inv-${objectId}`,
    source: "bike_lane_inventory",
    name,
    facility_type: facilityFromInventoryFlags(raw),
    status: "existing",
    ward: asString(raw.WARD_ID),
    length_m: asNumber(raw.LENGTH),
    geometry: f.geometry,
    raw,
    synced_at: new Date().toISOString(),
  };
}

function normalizeExistingTrail(f: RawFeature): BikeSegment | null {
  const raw = f.properties;
  const objectId = asString(raw.OBJECTID);
  const name = asString(raw.TRAIL_NAME) ?? asString(raw.NAME);
  if (!objectId || !name || !f.geometry) return null;

  const useType = (asString(raw.USE_TYPE) ?? "").toLowerCase();
  const facilityType: FacilityType =
    useType.includes("bike") && useType.includes("ped") ? "shared_path" :
    useType.includes("bike") ? "trail" : "shared_path";

  return {
    id: `trail-${objectId}`,
    source: "bike_trail",
    name,
    facility_type: facilityType,
    status: "existing",
    ward: asString(raw.WARDS),
    length_m: asNumber(raw.SEGMENT_LENGTH),
    geometry: f.geometry,
    raw,
    synced_at: new Date().toISOString(),
  };
}

function normalizePlannedTrail(f: RawFeature): BikeSegment | null {
  const raw = f.properties;
  const objectId = asString(raw.OBJECTID);
  const name = asString(raw.TRAIL_NAME) ?? asString(raw.ALETERNATE_NAME);
  if (!objectId || !name || !f.geometry) return null;

  return {
    id: `planned-trail-${objectId}`,
    source: "planned_trail",
    name,
    facility_type: "shared_path",
    status: trailStatus(raw.STATUS),
    ward: asString(raw.WARDS),
    length_m: asNumber(raw.LENGTH),
    geometry: f.geometry,
    raw,
    synced_at: new Date().toISOString(),
  };
}

// ─── Public fetch functions ───────────────────────────────────────────────────

export async function fetchBikeLaneInventory(): Promise<BikeSegment[]> {
  const features = await fetchArcGis(BIKE_LANE_INVENTORY_URL, true);
  return features.map(normalizeBikeLaneInventory).filter((s): s is BikeSegment => s !== null);
}

export async function fetchExistingTrails(): Promise<BikeSegment[]> {
  const features = await fetchArcGis(EXISTING_TRAILS_URL, false);
  return features.map(normalizeExistingTrail).filter((s): s is BikeSegment => s !== null);
}

export async function fetchPlannedTrails(): Promise<BikeSegment[]> {
  const features = await fetchArcGis(PLANNED_TRAILS_URL, false);
  return features.map(normalizePlannedTrail).filter((s): s is BikeSegment => s !== null);
}
