"use client";

import dynamic from "next/dynamic";
import type { FeatureFilters, FeatureRecord } from "@/lib/types";

const MapView = dynamic(
  () => import("@/components/MapView").then((m) => ({ default: m.MapView })),
  { loading: () => <div className="map-loading" />, ssr: false },
);

export function MapWrapper({
  features,
  filters,
  selectedId,
}: {
  features: FeatureRecord[];
  filters?: FeatureFilters;
  selectedId?: string;
}) {
  return <MapView features={features} filters={filters} selectedId={selectedId} />;
}
