"use client";

import dynamic from "next/dynamic";
import type { ProjectFilters, ProjectRecord } from "@/lib/types";

const MapView = dynamic<{ features: ProjectRecord[]; filters?: ProjectFilters; selectedId?: string }>(
  () => import("@/components/MapView").then((m) => ({ default: m.MapView })),
  { loading: () => <div className="map-loading" />, ssr: false },
);

export function MapWrapper({
  features,
  filters,
  selectedId,
}: {
  features: ProjectRecord[];
  filters?: ProjectFilters;
  selectedId?: string;
}) {
  return <MapView features={features} filters={filters} selectedId={selectedId} />;
}
