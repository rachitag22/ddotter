"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { sourceTypeColor } from "@/lib/design";
import type { FeatureRecord } from "@/lib/types";

type RawSeg = { facility: string | null; label: string | null; coordinates?: [number, number][] };

function facilityColor(facility: string | null): string {
  const f = (facility ?? "").toLowerCase();
  if (f.includes("protected")) return "#147b58";
  if (f.includes("buffered")) return "#0891b2";
  if (f.includes("sharrow") || f.includes("shared lane")) return "#c2410c";
  if (f.includes("shared use") || f.includes("multi")) return "#7c3aed";
  return "#b26a00";
}

function facilityAbbrev(facility: string | null): string {
  const f = (facility ?? "").toLowerCase();
  if (f.includes("protected")) return "Protected";
  if (f.includes("buffered")) return "Buffered";
  if (f.includes("sharrow") || f.includes("shared lane")) return "Sharrow";
  if (f.includes("shared use") || f.includes("multi")) return "Shared Path";
  if (f.includes("bike lane")) return "Bike Lane";
  return facility ?? "?";
}

function getSegments(raw: Record<string, unknown>): RawSeg[] | null {
  const s = raw._segments;
  if (!Array.isArray(s) || s.length < 2) return null;
  if (!s.some((seg) => Array.isArray((seg as RawSeg).coordinates) && (seg as RawSeg).coordinates!.length > 0)) return null;
  return s as RawSeg[];
}

export function MapView({
  features,
  selectedId,
}: {
  features: FeatureRecord[];
  selectedId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <MapContainer
      center={[38.9072, -77.0369]}
      className="map-canvas"
      preferCanvas
      zoom={12}
      zoomControl={false}
      zoomDelta={0.5}
      zoomSnap={0.5}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        keepBuffer={3}
        updateWhenZooming={false}
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {features.flatMap((feature) => {
        const isSelected = feature.id === selectedId;
        const fill = sourceTypeColor[feature.source_type] ?? sourceTypeColor.capital_project;
        const params = new URLSearchParams(searchParams.toString());
        params.set("selected", feature.id);
        const onClick = () => router.push(`/?${params.toString()}`);

        // Bike lanes: render each segment with its own facility color + label
        if (feature.source_type === "bike_lane") {
          const segs = getSegments(feature.raw);
          if (segs) {
            return segs.flatMap((seg, i) => {
              const coords = seg.coordinates;
              if (!coords?.length) return [];
              const positions = coords.map(([lng, lat]) => [lat, lng] as [number, number]);
              const color = facilityColor(seg.facility);
              const abbrev = facilityAbbrev(seg.facility);
              const segLabel = seg.label && seg.label !== feature.name ? seg.label : null;
              const tooltipText = segLabel ? `${abbrev} · ${segLabel}` : abbrev;

              return [
                <Polyline
                  key={`${feature.id}-${i}`}
                  eventHandlers={{ click: onClick }}
                  pathOptions={{ color, opacity: isSelected ? 1 : 0.82, weight: isSelected ? 8 : 5 }}
                  positions={positions}
                >
                  {isSelected && (
                    <Tooltip className="seg-tooltip" direction="auto" permanent>
                      {tooltipText}
                    </Tooltip>
                  )}
                </Polyline>,
              ];
            });
          }
        }

        if (feature.geometry.type === "Point") {
          const [lng, lat] = feature.geometry.coordinates;
          return [
            <CircleMarker
              center={[lat, lng]}
              eventHandlers={{ click: onClick }}
              key={`${feature.id}-${isSelected}`}
              pathOptions={{
                color: isSelected ? fill : "#fff",
                fillColor: fill,
                fillOpacity: 0.9,
                weight: isSelected ? 4 : 2,
              }}
              radius={isSelected ? 13 : 9}
            />,
          ];
        }

        if (feature.geometry.type === "LineString") {
          const positions = feature.geometry.coordinates.map(
            ([lng, lat]) => [lat, lng] as [number, number],
          );
          return [
            <Polyline
              eventHandlers={{ click: onClick }}
              key={`${feature.id}-${isSelected}`}
              pathOptions={{ color: fill, opacity: isSelected ? 1 : 0.75, weight: isSelected ? 9 : 5 }}
              positions={positions}
            />,
          ];
        }

        if (feature.geometry.type === "MultiLineString") {
          const positions = feature.geometry.coordinates.map((line) =>
            line.map(([lng, lat]) => [lat, lng] as [number, number]),
          );
          return [
            <Polyline
              eventHandlers={{ click: onClick }}
              key={`${feature.id}-${isSelected}`}
              pathOptions={{ color: fill, opacity: isSelected ? 1 : 0.75, weight: isSelected ? 9 : 5 }}
              positions={positions}
            />,
          ];
        }

        return [];
      })}
    </MapContainer>
  );
}
