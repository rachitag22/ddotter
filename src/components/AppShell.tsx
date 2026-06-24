"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MapWrapper } from "@/components/MapWrapper";
import { BottomDrawer } from "@/components/BottomDrawer";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Geometry, ListProjectRecord, MapBounds, PillState, ProjectAsset, ProjectRecord } from "@/lib/types";

function coordInBounds(lat: number, lng: number, b: MapBounds): boolean {
  return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
}

function geometryInBounds(geometry: Geometry, b: MapBounds): boolean {
  if (geometry.type === "Point") {
    return coordInBounds(geometry.coordinates[1], geometry.coordinates[0], b);
  }
  const lines = geometry.type === "LineString"
    ? [geometry.coordinates]
    : geometry.coordinates;
  return lines.some((line) => line.some(([lng, lat]) => coordInBounds(lat, lng, b)));
}

function toListProject({ raw: _raw, geometry: _geo, ...rest }: ProjectRecord) {
  return rest;
}

const DEFAULT_PILLS: PillState = { active: true, building: true, planned: true };

async function loadAllProjects(): Promise<ProjectRecord[]> {
  const supabase = getSupabaseBrowserClient();
  const pageSize = 1000;
  const all: ProjectRecord[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("projects_with_feedback")
      .select("*")
      .in("source_type", ["bike_lane", "trail_project"])
      .in("status", ["active", "planned"])
      .order("synced_at", { ascending: false })
      .range(from, from + pageSize - 1);
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
  const selectedId = searchParams.get("selected") || undefined;

  const [allProjects, setAllProjects] = useState<ProjectRecord[]>([]);
  const [pills, setPills] = useState<PillState>(DEFAULT_PILLS);
  const [search, setSearch] = useState("");
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<ProjectAsset[]>([]);

  // Load once on mount — pills filter client-side
  useEffect(() => {
    loadAllProjects().then(setAllProjects);
  }, []);

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

  const projects = allProjects.filter((p) => {
    if (!((pills.building && p.status === "active") || (pills.planned && p.status === "planned"))) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${p.name} ${p.description ?? ""} ${p.mode ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (mapBounds && !geometryInBounds(p.geometry, mapBounds)) return false;
    return true;
  });

  const listProjects: ListProjectRecord[] = projects.map(toListProject);
  const listSelected = selectedProject ? toListProject(selectedProject) : null;

  return (
    <>
      <MapWrapper features={projects} pills={pills} selectedId={selectedId} onBoundsChange={setMapBounds} />
      <BottomDrawer
        features={listProjects}
        pills={pills}
        onPillChange={setPills}
        search={search}
        onSearchChange={setSearch}
        selectedId={selectedId}
        selectedFeature={listSelected}
        selectedAssets={selectedAssets}
      />
    </>
  );
}
