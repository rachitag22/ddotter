"use client";

import dynamic from "next/dynamic";
import type { FeatureRecord } from "@/lib/types";

const MapView = dynamic(
  () => import("@/components/MapView").then((m) => ({ default: m.MapView })),
  { loading: () => <div className="map-loading" />, ssr: false },
);

export function MapWrapper({ features, selectedId }: { features: FeatureRecord[]; selectedId?: string }) {
  return <MapView features={features} selectedId={selectedId} />;
}
