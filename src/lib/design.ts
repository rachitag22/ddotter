/**
 * JS-accessible design tokens.
 * Color values must stay in sync with the custom properties in globals.css :root.
 */

export const colors = {
  green:  "#147b58",
  gold:   "#b26a00",
  blue:   "#2767b1",
  red:    "#b42318",
  text:   "#17211d",
  muted:  "#5c6862",
  line:   "#dfe6e1",
  bg:     "#f5f7f4",
  panel:  "#ffffff",
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
