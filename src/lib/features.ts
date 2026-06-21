import { unstable_cache } from "next/cache";
import { sampleFeatures } from "@/lib/sample-data";
import { getSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase";
import type { FeatureFilters, FeatureRecord } from "@/lib/types";

function matchesFilters(feature: FeatureRecord, filters: FeatureFilters) {
  if (filters.type && feature.source_type !== filters.type) return false;
  if (filters.ward && feature.ward !== filters.ward) return false;
  if (filters.status) {
    const statuses = filters.status.split(",");
    if (!statuses.includes(feature.status)) return false;
  }

  if (filters.q) {
    const query = filters.q.toLowerCase();
    const haystack = `${feature.name} ${feature.description ?? ""} ${feature.mode ?? ""}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  return true;
}

export function getFiltersFromSearchParams(searchParams: URLSearchParams): FeatureFilters {
  return {
    type: searchParams.get("type") || undefined,
    ward: searchParams.get("ward") || undefined,
    status: searchParams.get("status") || undefined,
    q: searchParams.get("q") || undefined,
  };
}

async function fetchFeatures(filters: FeatureFilters): Promise<FeatureRecord[]> {
  const supabase = getSupabaseServerClient();
  const pageSize = 1000;
  const features: FeatureRecord[] = [];

  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from("features_with_feedback")
      .select("*")
      .order("synced_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (filters.type) query = query.eq("source_type", filters.type);
    if (filters.ward) query = query.eq("ward", filters.ward);
    if (filters.status) {
      const statuses = filters.status.split(",");
      query = statuses.length === 1
        ? query.eq("status", statuses[0])
        : query.in("status", statuses);
    }
    if (filters.q) query = query.or(`name.ilike.%${filters.q}%,description.ilike.%${filters.q}%`);

    const { data, error } = await query;
    if (error) throw error;

    features.push(...((data ?? []) as FeatureRecord[]));
    if (!data || data.length < pageSize) break;
  }

  return features;
}

// Cache per unique filter combination; revalidate after each sync run via the
// "features" tag (call revalidateTag("features") from the sync route).
const getCachedFeatures = unstable_cache(fetchFeatures, ["features"], {
  revalidate: 300,
  tags: ["features"],
});

export async function getFeatures(filters: FeatureFilters = {}) {
  if (!hasSupabaseConfig()) {
    return sampleFeatures.filter((feature) => matchesFilters(feature, filters));
  }
  return getCachedFeatures(filters);
}

export async function getFeature(id: string) {
  if (!hasSupabaseConfig()) {
    return sampleFeatures.find((feature) => feature.id === id) ?? null;
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("features_with_feedback")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as FeatureRecord | null;
}

export function toGeoJson(features: FeatureRecord[]) {
  return {
    type: "FeatureCollection",
    features: features.map((feature) => ({
      type: "Feature",
      id: feature.id,
      geometry: feature.geometry,
      properties: {
        name: feature.name,
        source_type: feature.source_type,
        status: feature.status,
        ward: feature.ward,
        mode: feature.mode,
        feedback_count: feature.feedback_count ?? 0,
        support_percent: feature.support_percent ?? 0,
      },
    })),
  };
}
