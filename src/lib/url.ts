import type { FeatureFilters } from "@/lib/types";

export function buildSelectedUrl(featureId: string, filters: FeatureFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.ward) params.set("ward", filters.ward);
  if (filters.status) params.set("status", filters.status);
  if (filters.q) params.set("q", filters.q);
  params.set("selected", featureId);
  return `/?${params.toString()}`;
}

export function buildCloseUrl(filters: FeatureFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.ward) params.set("ward", filters.ward);
  if (filters.status) params.set("status", filters.status);
  if (filters.q) params.set("q", filters.q);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}
