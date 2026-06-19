"use client";

import { MapContainer, TileLayer, CircleMarker, Polyline, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { sourceTypeColor } from "@/lib/design";
import type { FeatureRecord } from "@/lib/types";

export function MapView({ features }: { features: FeatureRecord[] }) {
  return (
    <MapContainer
      center={[38.9072, -77.0369]}
      className="map-canvas"
      zoom={12}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {features.map((feature) => {
        const color = sourceTypeColor[feature.source_type] ?? sourceTypeColor.capital_project;

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
                <a className="map-popup-link" href={`/features/${feature.id}`}>
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
                <a className="map-popup-link" href={`/features/${feature.id}`}>
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
