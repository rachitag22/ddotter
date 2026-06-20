"use client";

import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { sourceTypeColor, sourceTypeLabel } from "@/lib/design";
import type { FeatureRecord } from "@/lib/types";

function FeaturePopup({ feature }: { feature: FeatureRecord }) {
  return (
    <div className="map-popup">
      <p className="map-popup-name">{feature.name}</p>
      <div className="map-popup-meta">
        <span className={`badge ${feature.status}`}>{feature.status}</span>
        <span className="badge">
          {feature.mode ?? sourceTypeLabel[feature.source_type] ?? feature.source_type}
        </span>
      </div>
      <a className="map-popup-link" href={`/?selected=${feature.id}`}>
        View project →
      </a>
    </div>
  );
}

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
        const baseColor = sourceTypeColor[feature.source_type] ?? sourceTypeColor.capital_project;
        const color = isSelected ? "#ffffff" : baseColor;
        const fillColor = baseColor;

        if (feature.geometry.type === "Point") {
          const [lng, lat] = feature.geometry.coordinates;
          return (
            <CircleMarker
              center={[lat, lng]}
              eventHandlers={{ click: () => router.push(`/?selected=${feature.id}`) }}
              key={feature.id}
              pathOptions={{
                color: isSelected ? baseColor : "#fff",
                fillColor,
                fillOpacity: 0.9,
                weight: isSelected ? 4 : 2,
              }}
              radius={isSelected ? 12 : 9}
            >
              <Popup autoPan={false} maxWidth={220} minWidth={180}>
                <FeaturePopup feature={feature} />
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
              eventHandlers={{ click: () => router.push(`/?selected=${feature.id}`) }}
              key={feature.id}
              pathOptions={{ color: fillColor, opacity: isSelected ? 1 : 0.85, weight: isSelected ? 8 : 5 }}
              positions={positions}
            >
              <Popup autoPan={false} maxWidth={220} minWidth={180}>
                <FeaturePopup feature={feature} />
              </Popup>
            </Polyline>
          );
        }

        if (feature.geometry.type === "MultiLineString") {
          const positions = feature.geometry.coordinates.map((line) =>
            line.map(([lng, lat]) => [lat, lng] as [number, number]),
          );
          return (
            <Polyline
              eventHandlers={{ click: () => router.push(`/?selected=${feature.id}`) }}
              key={feature.id}
              pathOptions={{ color: fillColor, opacity: isSelected ? 1 : 0.85, weight: isSelected ? 8 : 5 }}
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
