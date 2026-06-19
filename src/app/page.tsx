import { getFeatures } from "@/lib/features";
import { MapWrapper } from "@/components/MapWrapper";
import { BottomDrawer } from "@/components/BottomDrawer";

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
  const features = await getFeatures(filters);

  return (
    <div className="app">
      <MapWrapper features={features} />
      <BottomDrawer features={features} filters={filters} />
    </div>
  );
}
