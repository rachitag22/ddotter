"use client";

import { MapContainer, TileLayer, CircleMarker, Polyline, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { FeatureRecord } from "@/lib/types";

const TYPE_COLOR: Record<string, string> = {
  capital_project: "#147b58",
  trail_project: "#2767b1",
  art_installation: "#b26a00",
};

export function MapView({ features }: { features: FeatureRecord[] }) {
  return (
    <MapContainer
      center={[38.9072, -77.0369]}
      zoom={12}
      style={{ position: "fixed", inset: 0, zIndex: 0 }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {features.map((feature) => {
        const color = TYPE_COLOR[feature.source_type] ?? "#147b58";

        if (feature.geometry.type === "Point") {
          const [lng, lat] = feature.geometry.coordinates;
          return (
            <CircleMarker
              center={[lat, lng]}
              key={feature.id}
              pathOptions={{ color: "#fff", fillColor: color, fillOpacity: 0.9, weight: 2 }}
              radius={9}
            >
              <Popup>
                <strong>{feature.name}</strong>
                <br />
                <a href={`/features/${feature.id}`} style={{ color }}>
                  View project →
                </a>
              </Popup>
            </CircleMarker>
          );
        }

        if (feature.geometry.type === "LineString") {
          const positions = feature.geometry.coordinates.map(
            ([lng, lat]) => [lat, lng] as [number, number],
          );
          return (
            <Polyline
              key={feature.id}
              pathOptions={{ color, opacity: 0.85, weight: 5 }}
              positions={positions}
            >
              <Popup>
                <strong>{feature.name}</strong>
                <br />
                <a href={`/features/${feature.id}`} style={{ color }}>
                  View project →
                </a>
              </Popup>
            </Polyline>
          );
        }

        return null;
      })}
    </MapContainer>
  );
}
