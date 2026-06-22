import { getProject, getProjects } from "@/lib/projects";
import { MapWrapper } from "@/components/MapWrapper";
import { BottomDrawer } from "@/components/BottomDrawer";
import type { ProjectRecord } from "@/lib/types";

function toListProject({ raw: _raw, geometry: _geo, ...rest }: ProjectRecord) {
  return rest;
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const hasAnyFilter = params.type || params.ward || params.status || params.q;
  const filters = {
    type: first(params.type) ?? (hasAnyFilter ? undefined : "bike_lane"),
    ward: first(params.ward),
    status: first(params.status) ?? (hasAnyFilter ? undefined : "active,planned"),
    q: first(params.q),
  };
  const selected = first(params.selected);

  const [projects, selectedProject] = await Promise.all([
    getProjects(filters),
    selected ? getProject(selected) : Promise.resolve(null),
  ]);

  return (
    <div className="app">
      <MapWrapper features={projects} filters={filters} selectedId={selected} />
      <BottomDrawer
        features={projects.map(toListProject)}
        filters={filters}
        selectedId={selected}
        selectedFeature={selectedProject ? toListProject(selectedProject) : null}
      />
    </div>
  );
}
