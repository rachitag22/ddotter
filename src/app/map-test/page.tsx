"use client";

import { APIProvider, Map } from "@vis.gl/react-google-maps";

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

// DC center
const DC_CENTER = { lat: 38.9072, lng: -77.0369 };

export default function MapTestPage() {
  return (
    <div className="map-test-shell">
      <div className="map-test-header">
        Google Maps Dynamic Map API — test
      </div>
      <APIProvider apiKey={GOOGLE_MAPS_KEY}>
        <div className="map-test-canvas">
          <Map
            className="map-test-canvas"
            defaultCenter={DC_CENTER}
            defaultZoom={12}
            gestureHandling="greedy"
            disableDefaultUI={false}
            mapTypeId="roadmap"
          />
        </div>
      </APIProvider>
    </div>
  );
}
