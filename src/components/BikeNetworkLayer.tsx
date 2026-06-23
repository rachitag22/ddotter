"use client";

import { useEffect, useRef, useState } from "react";
import { InfoWindow, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { facilityTypeColor, facilityTypeLabel, mapStyles } from "@/lib/design";
import type { BikeSegment, FacilityType, Geometry } from "@/lib/types";

type ClickInfo = {
  position: google.maps.LatLngLiteral;
  facilityType: FacilityType;
  ward: string | null;
};

// ─── Single segment polyline ──────────────────────────────────────────────────

function NetworkPolyline({
  geometry,
  color,
  onClick,
}: {
  geometry: Geometry;
  color: string;
  onClick: (e: google.maps.MapMouseEvent) => void;
}) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

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
    const listeners = polylines.map((p) =>
      p.addListener("click", (e: google.maps.MapMouseEvent) => { e.stop(); onClickRef.current(e); }),
    );

    return () => { listeners.forEach((l) => l.remove()); polylines.forEach((p) => p.setMap(null)); };
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
      `${url}/rest/v1/bike_network?select=id,source,facility_type,status,ward,geometry&status=eq.existing&offset=${offset}&limit=${pageSize}`,
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

export function BikeNetworkLayer({ enabled }: { enabled: boolean }) {
  const [segments, setSegments] = useState<BikeSegment[]>([]);
  const [clickInfo, setClickInfo] = useState<ClickInfo | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!enabled || fetchedRef.current) return;
    fetchedRef.current = true;
    fetchBikeNetwork().then(setSegments);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      {segments.map((seg) => (
        <NetworkPolyline
          key={seg.id}
          geometry={seg.geometry}
          color={facilityTypeColor[seg.facility_type] ?? facilityTypeColor.unknown}
          onClick={(e) => {
            const latLng = e.latLng;
            if (!latLng) return;
            setClickInfo({
              position: { lat: latLng.lat(), lng: latLng.lng() },
              facilityType: seg.facility_type,
              ward: seg.ward,
            });
          }}
        />
      ))}
      {clickInfo && (
        <InfoWindow position={clickInfo.position} onCloseClick={() => setClickInfo(null)}>
          <div className="network-info-window">
            <p className="network-info-type">{facilityTypeLabel[clickInfo.facilityType]}</p>
            {clickInfo.ward && <p className="network-info-meta">Ward {clickInfo.ward}</p>}
            <p className="network-info-meta">Existing bike network</p>
          </div>
        </InfoWindow>
      )}
    </>
  );
}
