"use client";

import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, CircleMarker, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { sourceTypeColor } from "@/lib/design";
import type { FeatureRecord } from "@/lib/types";

export function MapView({
  features,
  selectedId,
}: {
  features: FeatureRecord[];
  selectedId?: string;
}) {
  const router = useRouter();

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
      {features.map((feature) => {
        const isSelected = feature.id === selectedId;
        const fill = sourceTypeColor[feature.source_type] ?? sourceTypeColor.capital_project;
        const onClick = () => router.push(`/?selected=${feature.id}`);

        if (feature.geometry.type === "Point") {
          const [lng, lat] = feature.geometry.coordinates;
          return (
            <CircleMarker
              center={[lat, lng]}
              eventHandlers={{ click: onClick }}
              key={feature.id}
              pathOptions={{
                color: isSelected ? fill : "#fff",
                fillColor: fill,
                fillOpacity: 0.9,
                weight: isSelected ? 4 : 2,
              }}
              radius={isSelected ? 13 : 9}
            />
          );
        }

        if (feature.geometry.type === "LineString") {
          const positions = feature.geometry.coordinates.map(
            ([lng, lat]) => [lat, lng] as [number, number],
          );
          return (
            <Polyline
              eventHandlers={{ click: onClick }}
              key={feature.id}
              pathOptions={{ color: fill, opacity: isSelected ? 1 : 0.75, weight: isSelected ? 9 : 5 }}
              positions={positions}
            />
          );
        }

        if (feature.geometry.type === "MultiLineString") {
          const positions = feature.geometry.coordinates.map((line) =>
            line.map(([lng, lat]) => [lat, lng] as [number, number]),
          );
          return (
            <Polyline
              eventHandlers={{ click: onClick }}
              key={feature.id}
              pathOptions={{ color: fill, opacity: isSelected ? 1 : 0.75, weight: isSelected ? 9 : 5 }}
              positions={positions}
            />
          );
        }

        if (feature.geometry.type === "MultiLineString") {
          const positions = feature.geometry.coordinates.map((line) =>
            line.map(([lng, lat]) => [lat, lng] as [number, number]),
          );
          return (
            <Polyline
              key={feature.id}
              pathOptions={{ color, opacity: 0.85, weight: 5 }}
              positions={positions}
            >
              <Popup autoPan={false} maxWidth={220} minWidth={180}>
                <FeaturePopup feature={feature} />
              </Popup>
            </Polyline>
          );
        }

        return null;
      })}
    </MapContainer>
  );
}
