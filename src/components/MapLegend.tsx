"use client";

import type { PillState } from "@/lib/types";
import { buildingColor, plannedColor, facilityTypeColor } from "@/lib/design";

const FACILITY_ROWS = [
  { color: facilityTypeColor.protected, label: "Protected lane" },
  { color: facilityTypeColor.buffered, label: "Buffered lane" },
  { color: facilityTypeColor.conventional, label: "Conventional lane" },
  { color: facilityTypeColor.sharrow, label: "Sharrow / shared" },
  { color: facilityTypeColor.trail, label: "Trail" },
];

export function MapLegend({ pills }: { pills: PillState }) {
  const showProjects = pills.building || pills.planned;

  return (
    <div className="map-legend">
      {pills.active && (
        <div className="legend-group">
          <p className="legend-group-label">Bike network</p>
          {FACILITY_ROWS.map((row) => (
            <div key={row.label} className="legend-row">
              <span className="legend-swatch" style={{ backgroundColor: row.color }} />
              <span className="legend-label">{row.label}</span>
            </div>
          ))}
        </div>
      )}
      {showProjects && (
        <div className={`legend-group${pills.active ? " legend-group--spaced" : ""}`}>
          <p className="legend-group-label">DDOT projects</p>
          {pills.building && (
            <div className="legend-row">
              <span className="legend-swatch" style={{ backgroundColor: buildingColor }} />
              <span className="legend-label">Building</span>
            </div>
          )}
          {pills.planned && (
            <div className="legend-row">
              <span className="legend-swatch" style={{ backgroundColor: plannedColor }} />
              <span className="legend-label">Planned</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
