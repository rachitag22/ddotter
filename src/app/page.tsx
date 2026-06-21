import { getFeature, getFeatures } from "@/lib/features";
import { MapWrapper } from "@/components/MapWrapper";
import { BottomDrawer } from "@/components/BottomDrawer";
import type { FeatureRecord } from "@/lib/types";

function toListFeature({ raw: _raw, geometry: _geo, ...rest }: FeatureRecord) {
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

  const [features, selectedFeature] = await Promise.all([
    getFeatures(filters),
    selected ? getFeature(selected) : Promise.resolve(null),
  ]);

  return (
    <div className="app">
      <MapWrapper features={features} filters={filters} selectedId={selected} />
      <BottomDrawer
        features={features.map(toListFeature)}
        filters={filters}
        selectedId={selected}
        selectedFeature={selectedFeature ? toListFeature(selectedFeature) : null}
      />
    </div>
  );
}
