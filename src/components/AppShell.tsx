"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MapWrapper } from "@/components/MapWrapper";
import { BottomDrawer } from "@/components/BottomDrawer";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { ListProjectRecord, ProjectAsset, ProjectFilters, ProjectRecord } from "@/lib/types";

type SelectedProjectData = {
  project: ProjectRecord | null;
  assets: ProjectAsset[];
};

const projectListCache = new Map<string, ProjectRecord[]>();
const selectedProjectCache = new Map<string, SelectedProjectData>();

function toListProject({ raw: _raw, geometry: _geo, ...rest }: ProjectRecord) {
  return rest;
}

function parseFilters(params: URLSearchParams): ProjectFilters {
  const type   = params.get("type")   || undefined;
  const ward   = params.get("ward")   || undefined;
  const status = params.get("status") || undefined;
  const q      = params.get("q")      || undefined;
  const hasAny = !!(type || ward || status || q);
  return {
    type:   type   ?? (hasAny ? undefined : "bike_lane"),
    ward,
    status: status ?? (hasAny ? undefined : "active,planned"),
    q,
  };
}

function matchesFilters(project: ProjectRecord, filters: ProjectFilters) {
  if (filters.type && project.source_type !== filters.type) return false;
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

function cacheKey(filters: ProjectFilters) {
  return JSON.stringify({
    type: filters.type ?? "",
    ward: filters.ward ?? "",
    status: filters.status ?? "",
    q: filters.q ?? "",
  });
}

async function loadProjects(filters: ProjectFilters): Promise<ProjectRecord[]> {
  const supabase = getSupabaseBrowserClient();
  const pageSize = 1000;
  const all: ProjectRecord[] = [];

  for (let from = 0; ; from += pageSize) {
    let q = supabase
      .from("projects_with_feedback")
      .select("*")
      .order("synced_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (filters.type) q = q.eq("source_type", filters.type);
    else q = q.neq("source_type", "art_installation");
    if (filters.ward) q = q.eq("ward", filters.ward);
    if (filters.status) {
      const statuses = filters.status.split(",");
      q = statuses.length === 1 ? q.eq("status", statuses[0]) : q.in("status", statuses);
    }
    if (filters.q) q = q.or(`name.ilike.%${filters.q}%,description.ilike.%${filters.q}%`);

    const { data, error } = await q;
    if (error) break;
    all.push(...((data ?? []) as ProjectRecord[]));
    if (!data || data.length < pageSize) break;
  }

  return all;
}

async function loadSelected(id: string): Promise<SelectedProjectData> {
  const supabase = getSupabaseBrowserClient();
  const [{ data: project }, { data: assets }] = await Promise.all([
    supabase.from("projects_with_feedback").select("*").eq("id", id).maybeSingle(),
    supabase.from("project_assets").select("*").eq("project_id", id).order("asset_type").order("title"),
  ]);
  return { project: (project as ProjectRecord | null) ?? null, assets: (assets ?? []) as ProjectAsset[] };
}

export function AppShell() {
  const searchParams = useSearchParams();
  const filters  = parseFilters(searchParams);
  const selectedId = searchParams.get("selected") || undefined;

  const [projects,       setProjects]       = useState<ProjectRecord[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(null);
  const [selectedAssets,  setSelectedAssets]  = useState<ProjectAsset[]>([]);
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);
  const [isSelectedLoading, setIsSelectedLoading] = useState(false);

  // Re-fetch project list whenever filters change
  useEffect(() => {
    let cancelled = false;
    const key = cacheKey(filters);
    const cached = projectListCache.get(key);
    if (cached) {
      setProjects(cached);
      setIsProjectsLoading(false);
      return () => { cancelled = true; };
    }

    setProjects([]);
    setIsProjectsLoading(true);
    loadProjects(filters)
      .then((data) => {
        if (cancelled) return;
        projectListCache.set(key, data);
        setProjects(data);
      })
      .finally(() => {
        if (!cancelled) setIsProjectsLoading(false);
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.type, filters.ward, filters.status, filters.q]);

  // Re-fetch selected project + assets whenever selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setSelectedProject(null);
      setSelectedAssets([]);
      setIsSelectedLoading(false);
      return;
    }
    let cancelled = false;
    const cached = selectedProjectCache.get(selectedId);
    if (cached) {
      setSelectedProject(cached.project);
      setSelectedAssets(cached.assets);
      setIsSelectedLoading(false);
      return () => { cancelled = true; };
    }

    setSelectedProject(null);
    setSelectedAssets([]);
    setIsSelectedLoading(true);
    loadSelected(selectedId).then(({ project, assets }) => {
      if (!cancelled) {
        selectedProjectCache.set(selectedId, { project, assets });
        setSelectedProject(project);
        setSelectedAssets(assets);
      }
    }).finally(() => {
      if (!cancelled) setIsSelectedLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedId]);

  const visibleProjects = useMemo(
    () => projects.filter((project) => matchesFilters(project, filters)),
    [projects, filters.type, filters.ward, filters.status, filters.q],
  );
  const listProjects: ListProjectRecord[] = visibleProjects.map(toListProject);
  const listSelected = selectedProject ? toListProject(selectedProject) : null;

  return (
    <>
      <MapWrapper features={visibleProjects} filters={filters} selectedId={selectedId} />
      <BottomDrawer
        features={listProjects}
        filters={filters}
        selectedId={selectedId}
        selectedFeature={listSelected}
        selectedAssets={selectedAssets}
        isDetailLoading={isSelectedLoading}
        isListLoading={isProjectsLoading}
      />
    </>
  );
}
