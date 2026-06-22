import { unstable_cache } from "next/cache";
import { sampleProjects } from "@/lib/sample-data";
import { getSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase";
import type { ProjectFilters, ProjectRecord } from "@/lib/types";

function matchesFilters(project: ProjectRecord, filters: ProjectFilters) {
  if (filters.type) {
    if (project.source_type !== filters.type) return false;
  } else if (project.source_type === "art_installation") {
    return false;
  }
  if (filters.ward && project.ward !== filters.ward) return false;
  if (filters.status) {
    const statuses = filters.status.split(",");
    if (!statuses.includes(project.status)) return false;
  }

  if (filters.q) {
    const query = filters.q.toLowerCase();
    const haystack = `${project.name} ${project.description ?? ""} ${project.mode ?? ""}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  return true;
}

export function getFiltersFromSearchParams(searchParams: URLSearchParams): ProjectFilters {
  return {
    type: searchParams.get("type") || undefined,
    ward: searchParams.get("ward") || undefined,
    status: searchParams.get("status") || undefined,
    q: searchParams.get("q") || undefined,
  };
}

async function fetchProjects(filters: ProjectFilters): Promise<ProjectRecord[]> {
  const supabase = getSupabaseServerClient();
  const pageSize = 1000;
  const projects: ProjectRecord[] = [];

  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from("features_with_feedback")
      .select("*")
      .order("synced_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (filters.type) {
      query = query.eq("source_type", filters.type);
    } else {
      query = query.neq("source_type", "art_installation");
    }
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

    projects.push(...((data ?? []) as ProjectRecord[]));
    if (!data || data.length < pageSize) break;
  }

  return projects;
}

const getCachedProjects = unstable_cache(fetchProjects, ["projects"], {
  revalidate: 300,
  tags: ["projects"],
});

export async function getProjects(filters: ProjectFilters = {}) {
  if (!hasSupabaseConfig()) {
    return sampleProjects.filter((project) => matchesFilters(project, filters));
  }
  return getCachedProjects(filters);
}

export async function getProject(id: string) {
  if (!hasSupabaseConfig()) {
    return sampleProjects.find((project) => project.id === id) ?? null;
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("features_with_feedback")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as ProjectRecord | null;
}

export function toGeoJson(projects: ProjectRecord[]) {
  return {
    type: "FeatureCollection",
    features: projects.map((project) => ({
      type: "Feature",
      id: project.id,
      geometry: project.geometry,
      properties: {
        name: project.name,
        source_type: project.source_type,
        status: project.status,
        ward: project.ward,
        mode: project.mode,
        feedback_count: project.feedback_count ?? 0,
        support_percent: project.support_percent ?? 0,
      },
    })),
  };
}
