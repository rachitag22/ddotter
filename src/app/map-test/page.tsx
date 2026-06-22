"use client";

import { APIProvider, Map } from "@vis.gl/react-google-maps";

// Google Maps demo key — replace with a real key for production
const DEMO_KEY = "AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFmBad";

// DC center
const DC_CENTER = { lat: 38.9072, lng: -77.0369 };

export default function MapTestPage() {
  return (
    <div className="map-test-shell">
      <div className="map-test-header">
        Google Maps Dynamic Map API — demo key test
      </div>
      <APIProvider apiKey={DEMO_KEY}>
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
