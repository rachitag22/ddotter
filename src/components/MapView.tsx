"use client";

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
      <a className="map-popup-link" href={`/features/${feature.id}`}>
        View project →
      </a>
    </div>
  );
}

export function MapView({ features }: { features: FeatureRecord[] }) {
  return (
    <MapContainer
      center={[38.9072, -77.0369]}
      className="map-canvas"
      // Canvas renderer keeps dots crisp during zoom; SVG pane gets CSS-scaled
      // as a rasterized bitmap before re-rendering, which causes blur.
      preferCanvas
      zoom={12}
      zoomControl={false}
      // Half-level zoom steps reduce the CSS scale factor per animation frame
      // (1.41× instead of 2×), so dots stay readable mid-animation.
      zoomDelta={0.5}
      zoomSnap={0.5}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        // Don't request new tiles mid-animation; load them once zoom settles.
        keepBuffer={3}
        updateWhenZooming={false}
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
