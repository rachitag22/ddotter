import type { FacilityType } from "@/lib/types";

export const colors = {
  green:  "#147b58",
  gold:   "#b26a00",
  blue:   "#2767b1",
  red:    "#b42318",
  teal:   "#0891b2",
  cyan:   "#06b6d4",
  purple: "#7c3aed",
  orange: "#c2410c",
  mint:   "#1db87a",
  gray:   "#9ca3af",
  white:  "#ffffff",
  text:   "#17211d",
  muted:  "#5c6862",
  line:   "#dfe6e1",
  bg:     "#f5f7f4",
  panel:  "#ffffff",
} as const;

export const colorAlpha = {
  selectedHaloHex: "40",
} as const;

/** Map marker / polyline fill color keyed by source_type. */
export const sourceTypeColor: Record<string, string> = {
  capital_project:  colors.green,
  bike_lane:        colors.red,
  trail_project:    colors.blue,
  art_installation: colors.gold,
};

/** Human-readable label keyed by source_type. */
export const sourceTypeLabel: Record<string, string> = {
  capital_project:  "Capital project",
  bike_lane:        "Bike lane",
  trail_project:    "Trail project",
  art_installation: "Art / memorial",
};

export const facilityTypeColor: Record<FacilityType, string> = {
  protected: colors.green,
  dual_protected: colors.mint,
  buffered: colors.teal,
  dual_buffered: colors.cyan,
  conventional: colors.gold,
  contraflow: colors.orange,
  sharrow: colors.purple,
  shared_path: colors.blue,
  trail: colors.blue,
  unknown: colors.gray,
};

export function facilityColor(facility: string | null): string {
  const value = (facility ?? "").toLowerCase();
  if (value.includes("protected")) return facilityTypeColor.protected;
  if (value.includes("buffered")) return facilityTypeColor.buffered;
  if (value.includes("sharrow") || value.includes("shared lane")) return facilityTypeColor.sharrow;
  if (value.includes("shared use") || value.includes("multi")) return facilityTypeColor.shared_path;
  return facilityTypeColor.conventional;
}

export function facilityAbbrev(facility: string | null): string {
  const value = (facility ?? "").toLowerCase();
  if (value.includes("protected")) return "Protected";
  if (value.includes("buffered")) return "Buffered";
  if (value.includes("sharrow") || value.includes("shared lane")) return "Sharrow";
  if (value.includes("shared use") || value.includes("multi")) return "Shared Path";
  if (value.includes("bike lane")) return "Bike Lane";
  return facility ?? "?";
}

export const mapStyles = {
  marker: {
    borderRadius: "50%",
    cursor: "pointer",
    defaultBorder: `2px solid ${colors.white}`,
    defaultShadow: "0 1px 4px rgba(0,0,0,0.25)",
    selectedBorderWidth: 4,
    selectedHaloWidth: 3,
    selectedSize: 26,
    size: 18,
    zIndex: 1,
    selectedZIndex: 10,
  },
  tooltip: {
    background: "rgba(23,33,29,0.88)",
    borderRadius: 6,
    color: colors.white,
    fontSize: 12,
    fontWeight: 500,
    padding: "4px 8px",
    pointerEvents: "none",
    whiteSpace: "nowrap",
    zIndex: 20,
  },
  polyline: {
    networkOpacity: 0.7,
    networkWeight: 2.5,
    networkZIndex: -1,
    featureOpacity: 0.75,
    selectedFeatureOpacity: 1,
    dimOpacity: 0.18,
    featureWeight: 5,
    selectedFeatureWeight: 9,
    segmentOpacity: 0.82,
    selectedSegmentOpacity: 1,
    segmentWeight: 5,
    selectedSegmentWeight: 8,
    zIndex: 2,
    selectedZIndex: 12,
  },
} as const;
