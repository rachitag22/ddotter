"use client";

import { useEffect, useRef, useState } from "react";
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { facilityTypeColor, mapStyles } from "@/lib/design";
import type { BikeSegment, Geometry } from "@/lib/types";

// ─── Single segment polyline ──────────────────────────────────────────────────

function NetworkPolyline({
  geometry,
  color,
}: {
  geometry: Geometry;
  color: string;
}) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  const ref = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || !mapsLib) return;

    const lines: google.maps.LatLngLiteral[][] =
      geometry.type === "LineString"
        ? [geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))]
        : geometry.type === "MultiLineString"
        ? geometry.coordinates.map((line) => line.map(([lng, lat]) => ({ lat, lng })))
        : [];

    const polylines = lines.map(
      (path) =>
        new mapsLib.Polyline({
          path,
          strokeColor: color,
          strokeOpacity: mapStyles.polyline.networkOpacity,
          strokeWeight: mapStyles.polyline.networkWeight,
          map,
          zIndex: mapStyles.polyline.networkZIndex,
        }),
    );

    ref.current = polylines[0] ?? null;
    return () => polylines.forEach((p) => p.setMap(null));
  }, [map, mapsLib, geometry, color]);

  return null;
}

// ─── Data fetch ───────────────────────────────────────────────────────────────

async function fetchBikeNetwork(): Promise<BikeSegment[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];

  const pageSize = 1000;
  const segments: BikeSegment[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const res = await fetch(
      `${url}/rest/v1/bike_network?select=id,source,facility_type,status,geometry&offset=${offset}&limit=${pageSize}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) break;
    const page: BikeSegment[] = await res.json();
    segments.push(...page);
    if (page.length < pageSize) break;
  }

  return segments;
}

// ─── Layer component (rendered inside <Map>) ──────────────────────────────────

export function BikeNetworkLayer() {
  const [enabled, setEnabled] = useState(false);
  const [segments, setSegments] = useState<BikeSegment[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  async function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    if (next && !fetchedRef.current) {
      setLoading(true);
      const data = await fetchBikeNetwork();
      setSegments(data);
      fetchedRef.current = true;
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating control — positioned over the map */}
      <div className="network-toggle">
        <label className="network-toggle-label">
          <input
            type="checkbox"
            checked={enabled}
            onChange={handleToggle}
            disabled={loading}
          />
          {loading ? "Loading…" : "Show existing network"}
        </label>
      </div>

      {/* Polylines rendered into the map */}
      {enabled &&
        segments.map((seg) => (
          <NetworkPolyline
            key={seg.id}
            geometry={seg.geometry}
            color={facilityTypeColor[seg.facility_type] ?? facilityTypeColor.unknown}
          />
        ))}
    </>
  );
}
