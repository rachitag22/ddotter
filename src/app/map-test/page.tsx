"use client";

import { APIProvider, Map } from "@vis.gl/react-google-maps";

// Google Maps demo key — replace with a real key for production
const DEMO_KEY = "AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFmBad";

// DC center
const DC_CENTER = { lat: 38.9072, lng: -77.0369 };

export default function MapTestPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ padding: "12px 16px", background: "#1a1a2e", color: "#fff", fontSize: 14 }}>
        Google Maps Dynamic Map API — demo key test
      </div>
      <APIProvider apiKey={DEMO_KEY}>
        <Map
          style={{ flex: 1 }}
          defaultCenter={DC_CENTER}
          defaultZoom={12}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapTypeId="roadmap"
        />
      </APIProvider>
    </div>
  );
}
