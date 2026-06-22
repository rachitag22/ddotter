import type { ProjectFilters } from "@/lib/types";

export function buildSelectedUrl(projectId: string, filters: ProjectFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.ward) params.set("ward", filters.ward);
  if (filters.status) params.set("status", filters.status);
  if (filters.q) params.set("q", filters.q);
  params.set("selected", projectId);
  return `/?${params.toString()}`;
}

export function buildCloseUrl(filters: ProjectFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.ward) params.set("ward", filters.ward);
  if (filters.status) params.set("status", filters.status);
  if (filters.q) params.set("q", filters.q);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}
