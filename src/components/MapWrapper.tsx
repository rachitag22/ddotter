"use client";

import dynamic from "next/dynamic";
import { APIProvider } from "@vis.gl/react-google-maps";
import { MapLegend } from "@/components/MapLegend";
import type { MapBounds, PillState, ProjectRecord } from "@/lib/types";

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

const MapView = dynamic<{
  features: ProjectRecord[];
  pills: PillState;
  selectedId?: string;
  onBoundsChange?: (b: MapBounds) => void;
}>(
  () => import("@/components/MapView").then((m) => ({ default: m.MapView })),
  { loading: () => <div className="map-loading" />, ssr: false },
);

export function MapWrapper({
  features,
  pills,
  selectedId,
  onBoundsChange,
}: {
  features: ProjectRecord[];
  pills: PillState;
  selectedId?: string;
  onBoundsChange?: (b: MapBounds) => void;
}) {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_KEY}>
      <MapView features={features} pills={pills} selectedId={selectedId} onBoundsChange={onBoundsChange} />
      <MapLegend pills={pills} />
    </APIProvider>
  );
}
