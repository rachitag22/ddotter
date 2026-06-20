import { getFeature, getFeatures } from "@/lib/features";
import { MapWrapper } from "@/components/MapWrapper";
import { BottomDrawer } from "@/components/BottomDrawer";
import { FeatureModal } from "@/components/FeatureModal";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = {
    type: first(params.type),
    ward: first(params.ward),
    status: first(params.status),
    q: first(params.q),
  };
  const selected = first(params.selected);

  const [features, selectedFeature] = await Promise.all([
    getFeatures(filters),
    selected ? getFeature(selected) : Promise.resolve(null),
  ]);

  return (
    <div className="app">
      <MapWrapper features={features} selectedId={selected} />
      <BottomDrawer features={features} filters={filters} selectedId={selected} />
      {selectedFeature && <FeatureModal feature={selectedFeature} filters={filters} />}
    </div>
  );
}
