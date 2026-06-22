"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Map, AdvancedMarker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import {
  colorAlpha,
  facilityAbbrev,
  facilityColor,
  mapStyles,
  sourceTypeColor,
} from "@/lib/design";
import { BikeNetworkLayer } from "@/components/BikeNetworkLayer";
import type { ProjectRecord } from "@/lib/types";

const DC_CENTER = { lat: 38.9072, lng: -77.0369 };

type RawSeg = { facility: string | null; label: string | null; coordinates?: [number, number][] };

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
  zIndex,
  onClick,
}: {
  path: google.maps.LatLngLiteral[];
  color: string;
  weight: number;
  opacity: number;
  zIndex: number;
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
      zIndex,
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
    polylineRef.current?.setOptions({ strokeColor: color, strokeOpacity: opacity, strokeWeight: weight, zIndex });
  }, [color, opacity, weight, zIndex]);

  // Update geometry when the same project receives fresh coordinates
  useEffect(() => {
    polylineRef.current?.setPath(path);
  }, [path]);

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
  isDeselected,
  onClick,
}: {
  position: google.maps.LatLngLiteral;
  color: string;
  isSelected: boolean;
  isDeselected: boolean;
  onClick: () => void;
}) {
  const marker = mapStyles.marker;
  const size = isSelected ? marker.selectedSize : marker.size;
  const border = isSelected ? `${marker.selectedBorderWidth}px solid ${color}` : marker.defaultBorder;
  const boxShadow = isSelected
    ? `0 0 0 ${marker.selectedHaloWidth}px ${color}${colorAlpha.selectedHaloHex}`
    : marker.defaultShadow;

  return (
    <AdvancedMarker position={position} onClick={onClick} zIndex={isSelected ? marker.selectedZIndex : marker.zIndex}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: marker.borderRadius,
          background: color,
          border,
          boxShadow,
          cursor: marker.cursor,
          opacity: isDeselected ? 0.2 : 1,
          transition: "opacity 0.2s",
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
  const tooltip = mapStyles.tooltip;

  return (
    <AdvancedMarker position={position} zIndex={tooltip.zIndex}>
      <div
        style={{
          background: tooltip.background,
          borderRadius: tooltip.borderRadius,
          color: tooltip.color,
          fontSize: tooltip.fontSize,
          fontWeight: tooltip.fontWeight,
          padding: tooltip.padding,
          pointerEvents: tooltip.pointerEvents,
          whiteSpace: tooltip.whiteSpace,
        }}
      >
        {text}
      </div>
    </AdvancedMarker>
  );
}

// ─── DC grey mask overlay ────────────────────────────────────────────────────

// Bounding box well outside DC (~5° buffer). CW winding (NW→NE→SE→SW) = outer
// filled ring. Kept tight so Google Maps renders it reliably at DC zoom levels.
const WORLD_RING: google.maps.LatLngLiteral[] = [
  { lat: 42, lng: -80 },
  { lat: 42, lng: -74 },
  { lat: 36, lng: -74 },
  { lat: 36, lng: -80 },
];

// DC boundary from src/data/dc_boundary.geojson, simplified with
// Ramer-Douglas-Peucker (epsilon=0.0005°, ~55m). CCW winding (GeoJSON native) =
// hole in the outer ring, leaving DC at full color.
const DC_BOUNDARY: google.maps.LatLngLiteral[] = [
  { lat: 38.934351, lng: -77.119795 },
  { lat: 38.932103, lng: -77.117519 },
  { lat: 38.928164, lng: -77.116008 },
  { lat: 38.919959, lng: -77.106848 },
  { lat: 38.916142, lng: -77.104254 },
  { lat: 38.91271, lng: -77.10302 },
  { lat: 38.907606, lng: -77.096591 },
  { lat: 38.903379, lng: -77.088135 },
  { lat: 38.901193, lng: -77.070587 },
  { lat: 38.900312, lng: -77.068668 },
  { lat: 38.8992, lng: -77.067553 },
  { lat: 38.890262, lng: -77.063786 },
  { lat: 38.88847, lng: -77.064156 },
  { lat: 38.880702, lng: -77.058972 },
  { lat: 38.87972, lng: -77.054143 },
  { lat: 38.876572, lng: -77.051533 },
  { lat: 38.873913, lng: -77.051687 },
  { lat: 38.871647, lng: -77.050192 },
  { lat: 38.872012, lng: -77.046529 },
  { lat: 38.873951, lng: -77.046383 },
  { lat: 38.874936, lng: -77.047204 },
  { lat: 38.875592, lng: -77.04584 },
  { lat: 38.86972, lng: -77.039454 },
  { lat: 38.866672, lng: -77.038001 },
  { lat: 38.864292, lng: -77.037926 },
  { lat: 38.86338, lng: -77.042765 },
  { lat: 38.862382, lng: -77.040359 },
  { lat: 38.863232, lng: -77.039782 },
  { lat: 38.863301, lng: -77.038084 },
  { lat: 38.861272, lng: -77.037588 },
  { lat: 38.85977, lng: -77.035401 },
  { lat: 38.857674, lng: -77.034164 },
  { lat: 38.855034, lng: -77.032845 },
  { lat: 38.85007, lng: -77.031992 },
  { lat: 38.844538, lng: -77.033073 },
  { lat: 38.840109, lng: -77.034595 },
  { lat: 38.839413, lng: -77.036806 },
  { lat: 38.839529, lng: -77.041789 },
  { lat: 38.840558, lng: -77.043361 },
  { lat: 38.840223, lng: -77.044685 },
  { lat: 38.841267, lng: -77.047901 },
  { lat: 38.840116, lng: -77.04589 },
  { lat: 38.839931, lng: -77.046504 },
  { lat: 38.838509, lng: -77.045368 },
  { lat: 38.836092, lng: -77.045054 },
  { lat: 38.835846, lng: -77.045595 },
  { lat: 38.831458, lng: -77.043287 },
  { lat: 38.831493, lng: -77.041938 },
  { lat: 38.833316, lng: -77.04258 },
  { lat: 38.833707, lng: -77.04188 },
  { lat: 38.832067, lng: -77.039137 },
  { lat: 38.830164, lng: -77.037848 },
  { lat: 38.824649, lng: -77.038812 },
  { lat: 38.823354, lng: -77.041053 },
  { lat: 38.822106, lng: -77.04072 },
  { lat: 38.82148, lng: -77.039578 },
  { lat: 38.820654, lng: -77.039968 },
  { lat: 38.819253, lng: -77.03885 },
  { lat: 38.815596, lng: -77.038129 },
  { lat: 38.814812, lng: -77.03614 },
  { lat: 38.800591, lng: -77.039185 },
  { lat: 38.791644, lng: -77.039023 },
  { lat: 38.892931, lng: -76.90915 },
  { lat: 38.995968, lng: -77.040966 },
];

function DcGreyOverlay() {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  const polygonRef = useRef<google.maps.Polygon | null>(null);

  useEffect(() => {
    if (!map || !mapsLib) return;
    polygonRef.current = new mapsLib.Polygon({
      paths: [WORLD_RING, DC_BOUNDARY],
      fillColor: "#9ba3ad",
      fillOpacity: 0.45,
      strokeWeight: 0,
      map,
    });
    return () => {
      polygonRef.current?.setMap(null);
    };
  }, [map, mapsLib]);

  return null;
}

// ─── Auto-pan to selected project ────────────────────────────────────────────

function coordBoundsLiteral(coords: [number, number][]): google.maps.LatLngBoundsLiteral {
  let north = -Infinity, south = Infinity, east = -Infinity, west = Infinity;
  for (const [lng, lat] of coords) {
    if (lat > north) north = lat;
    if (lat < south) south = lat;
    if (lng > east) east = lng;
    if (lng < west) west = lng;
  }
  return { north, south, east, west };
}

function MapController({ features, selectedId }: { features: ProjectRecord[]; selectedId?: string }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !selectedId) return;
    const project = features.find((f) => f.id === selectedId);
    if (!project) return;
    const { geometry } = project;

    if (geometry.type === "Point") {
      const [lng, lat] = geometry.coordinates;
      map.panTo({ lat, lng });
      if ((map.getZoom() ?? 0) < 14) map.setZoom(14);
    } else if (geometry.type === "LineString") {
      map.fitBounds(coordBoundsLiteral(geometry.coordinates), 60);
    } else if (geometry.type === "MultiLineString") {
      map.fitBounds(coordBoundsLiteral(geometry.coordinates.flat()), 60);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, map]);

  return null;
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

  function onMapClick() {
    if (!selectedId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("selected");
    router.push(`/?${params.toString()}`);
  }

  return (
    <Map
      className="map-canvas"
      defaultCenter={DC_CENTER}
      defaultZoom={12}
      disableDefaultUI={false}
      gestureHandling="greedy"
      mapId="13160d4e828befe69b060118"
      mapTypeId="roadmap"
      onClick={onMapClick}
    >
      <DcGreyOverlay />
      <BikeNetworkLayer />
      <MapController features={features} selectedId={selectedId} />
      {features.flatMap((project) => {
        const isSelected = project.id === selectedId;
        const isDeselected = !!selectedId && !isSelected;
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
                  opacity={isSelected ? mapStyles.polyline.selectedSegmentOpacity : isDeselected ? mapStyles.polyline.dimOpacity : mapStyles.polyline.segmentOpacity}
                  weight={isSelected ? mapStyles.polyline.selectedSegmentWeight : mapStyles.polyline.segmentWeight}
                  zIndex={isSelected ? mapStyles.polyline.selectedZIndex : mapStyles.polyline.zIndex}
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
          if (isDeselected) return [];
          const [lng, lat] = project.geometry.coordinates;
          return [
            <PointMarker
              key={`${project.id}-${isSelected}`}
              position={{ lat, lng }}
              color={fill}
              isSelected={isSelected}
              isDeselected={false}
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
              opacity={isSelected ? mapStyles.polyline.selectedFeatureOpacity : isDeselected ? mapStyles.polyline.dimOpacity : mapStyles.polyline.featureOpacity}
              weight={isSelected ? mapStyles.polyline.selectedFeatureWeight : mapStyles.polyline.featureWeight}
              zIndex={isSelected ? mapStyles.polyline.selectedZIndex : mapStyles.polyline.zIndex}
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
                opacity={isSelected ? mapStyles.polyline.selectedFeatureOpacity : isDeselected ? mapStyles.polyline.dimOpacity : mapStyles.polyline.featureOpacity}
                weight={isSelected ? mapStyles.polyline.selectedFeatureWeight : mapStyles.polyline.featureWeight}
                zIndex={isSelected ? mapStyles.polyline.selectedZIndex : mapStyles.polyline.zIndex}
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
