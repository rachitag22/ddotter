"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Map, AdvancedMarker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { sourceTypeColor } from "@/lib/design";
import type { ProjectRecord } from "@/lib/types";

const DC_CENTER = { lat: 38.9072, lng: -77.0369 };

type RawSeg = { facility: string | null; label: string | null; coordinates?: [number, number][] };

function facilityColor(facility: string | null): string {
  const f = (facility ?? "").toLowerCase();
  if (f.includes("protected")) return "#147b58";
  if (f.includes("buffered")) return "#0891b2";
  if (f.includes("sharrow") || f.includes("shared lane")) return "#c2410c";
  if (f.includes("shared use") || f.includes("multi")) return "#7c3aed";
  return "#b26a00";
}

function facilityAbbrev(facility: string | null): string {
  const f = (facility ?? "").toLowerCase();
  if (f.includes("protected")) return "Protected";
  if (f.includes("buffered")) return "Buffered";
  if (f.includes("sharrow") || f.includes("shared lane")) return "Sharrow";
  if (f.includes("shared use") || f.includes("multi")) return "Shared Path";
  if (f.includes("bike lane")) return "Bike Lane";
  return facility ?? "?";
}

function getSegments(raw: Record<string, unknown>): RawSeg[] | null {
  const s = raw._segments;
  if (!Array.isArray(s) || s.length < 2) return null;
  if (!s.some((seg) => Array.isArray((seg as RawSeg).coordinates) && (seg as RawSeg).coordinates!.length > 0)) return null;
  return s as RawSeg[];
}

function midpoint(coords: [number, number][]): google.maps.LatLngLiteral {
  const mid = coords[Math.floor(coords.length / 2)];
  return { lat: mid[1], lng: mid[0] };
}

// ─── Polyline overlay ────────────────────────────────────────────────────────

function GmPolyline({
  path,
  color,
  weight,
  opacity,
  onClick,
}: {
  path: google.maps.LatLngLiteral[];
  color: string;
  weight: number;
  opacity: number;
  onClick: () => void;
}) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const listenerRef = useRef<google.maps.MapsEventListener | null>(null);

  useEffect(() => {
    if (!map || !mapsLib) return;
    polylineRef.current = new mapsLib.Polyline({
      path,
      strokeColor: color,
      strokeOpacity: opacity,
      strokeWeight: weight,
      map,
    });
    listenerRef.current = polylineRef.current.addListener("click", onClick);
    return () => {
      listenerRef.current?.remove();
      polylineRef.current?.setMap(null);
    };
  }, [map, mapsLib]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update mutable style props without remounting
  useEffect(() => {
    polylineRef.current?.setOptions({ strokeColor: color, strokeOpacity: opacity, strokeWeight: weight });
  }, [color, opacity, weight]);

  // Update click handler
  useEffect(() => {
    listenerRef.current?.remove();
    if (polylineRef.current) {
      listenerRef.current = polylineRef.current.addListener("click", onClick);
    }
  }, [onClick]);

  return null;
}

// ─── Point marker ────────────────────────────────────────────────────────────

function PointMarker({
  position,
  color,
  isSelected,
  onClick,
}: {
  position: google.maps.LatLngLiteral;
  color: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const size = isSelected ? 26 : 18;
  const border = isSelected ? `4px solid ${color}` : "2px solid #fff";
  return (
    <AdvancedMarker position={position} onClick={onClick} zIndex={isSelected ? 10 : 1}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          border,
          boxShadow: isSelected ? `0 0 0 3px ${color}40` : "0 1px 4px rgba(0,0,0,0.25)",
          cursor: "pointer",
        }}
      />
    </AdvancedMarker>
  );
}

// ─── Segment tooltip ─────────────────────────────────────────────────────────

function SegmentTooltip({
  position,
  text,
}: {
  position: google.maps.LatLngLiteral;
  text: string;
}) {
  return (
    <AdvancedMarker position={position} zIndex={20}>
      <div
        style={{
          background: "rgba(23,33,29,0.88)",
          borderRadius: 6,
          color: "#fff",
          fontSize: 12,
          fontWeight: 500,
          padding: "4px 8px",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
    </AdvancedMarker>
  );
}

// ─── Main map ────────────────────────────────────────────────────────────────

export function MapView({
  features,
  selectedId,
}: {
  features: ProjectRecord[];
  selectedId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function makeOnClick(projectId: string) {
    return () => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("selected", projectId);
      router.push(`/?${params.toString()}`);
    };
  }

  return (
    <Map
      className="map-canvas"
      defaultCenter={DC_CENTER}
      defaultZoom={12}
      disableDefaultUI={false}
      gestureHandling="greedy"
      mapId="ddotter-map"
      mapTypeId="roadmap"
    >
      {features.flatMap((project) => {
        const isSelected = project.id === selectedId;
        const fill = sourceTypeColor[project.source_type] ?? sourceTypeColor.capital_project;
        const onClick = makeOnClick(project.id);

        // Bike lanes: render each segment with facility color + optional tooltip
        if (project.source_type === "bike_lane") {
          const segs = getSegments(project.raw);
          if (segs) {
            return segs.flatMap((seg, i) => {
              const coords = seg.coordinates;
              if (!coords?.length) return [];
              const path = coords.map(([lng, lat]) => ({ lat, lng }));
              const color = facilityColor(seg.facility);
              const abbrev = facilityAbbrev(seg.facility);
              const segLabel = seg.label && seg.label !== project.name ? seg.label : null;
              const tooltipText = segLabel ? `${abbrev} · ${segLabel}` : abbrev;

              return [
                <GmPolyline
                  key={`${project.id}-seg-${i}`}
                  path={path}
                  color={color}
                  opacity={isSelected ? 1 : 0.82}
                  weight={isSelected ? 8 : 5}
                  onClick={onClick}
                />,
                isSelected && (
                  <SegmentTooltip
                    key={`${project.id}-tip-${i}`}
                    position={midpoint(coords)}
                    text={tooltipText}
                  />
                ),
              ].filter(Boolean) as React.ReactElement[];
            });
          }
        }

        if (project.geometry.type === "Point") {
          const [lng, lat] = project.geometry.coordinates;
          return [
            <PointMarker
              key={`${project.id}-${isSelected}`}
              position={{ lat, lng }}
              color={fill}
              isSelected={isSelected}
              onClick={onClick}
            />,
          ];
        }

        if (project.geometry.type === "LineString") {
          const path = project.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
          return [
            <GmPolyline
              key={`${project.id}-${isSelected}`}
              path={path}
              color={fill}
              opacity={isSelected ? 1 : 0.75}
              weight={isSelected ? 9 : 5}
              onClick={onClick}
            />,
          ];
        }

        if (project.geometry.type === "MultiLineString") {
          return project.geometry.coordinates.map((line, li) => {
            const path = line.map(([lng, lat]) => ({ lat, lng }));
            return (
              <GmPolyline
                key={`${project.id}-line-${li}-${isSelected}`}
                path={path}
                color={fill}
                opacity={isSelected ? 1 : 0.75}
                weight={isSelected ? 9 : 5}
                onClick={onClick}
              />
            );
          });
        }

        return [];
      })}
    </Map>
  );
}
