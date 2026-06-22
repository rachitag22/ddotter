"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MapWrapper } from "@/components/MapWrapper";
import { BottomDrawer } from "@/components/BottomDrawer";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { ListProjectRecord, ProjectAsset, ProjectFilters, ProjectRecord } from "@/lib/types";

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

async function loadSelected(id: string): Promise<{ project: ProjectRecord | null; assets: ProjectAsset[] }> {
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

  // Re-fetch project list whenever filters change
  useEffect(() => {
    let cancelled = false;
    loadProjects(filters).then((data) => { if (!cancelled) setProjects(data); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.type, filters.ward, filters.status, filters.q]);

  // Re-fetch selected project + assets whenever selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setSelectedProject(null);
      setSelectedAssets([]);
      return;
    }
    let cancelled = false;
    loadSelected(selectedId).then(({ project, assets }) => {
      if (!cancelled) {
        setSelectedProject(project);
        setSelectedAssets(assets);
      }
    });
    return () => { cancelled = true; };
  }, [selectedId]);

  const listProjects: ListProjectRecord[] = projects.map(toListProject);
  const listSelected = selectedProject ? toListProject(selectedProject) : null;

  return (
    <>
      <MapWrapper features={projects} filters={filters} selectedId={selectedId} />
      <BottomDrawer
        features={listProjects}
        filters={filters}
        selectedId={selectedId}
        selectedFeature={listSelected}
        selectedAssets={selectedAssets}
      />
    </>
  );
}
