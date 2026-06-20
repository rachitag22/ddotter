import type { FeatureRecord } from "@/lib/types";

type RawSegment = { facility: string | null; label: string | null };

function isRawSegmentArray(value: unknown): value is RawSegment[] {
  return (
    Array.isArray(value) &&
    value.every(
      (s) =>
        typeof s === "object" &&
        s !== null &&
        ("facility" in s || "label" in s),
    )
  );
}

export function SegmentList({ feature }: { feature: FeatureRecord }) {
  const raw = feature.raw._segments;
  if (!isRawSegmentArray(raw) || raw.length < 2) return null;

  return (
    <section className="segment-list">
      <h2>Segments ({raw.length})</h2>
      <ul>
        {raw.map((seg, i) => (
          <li key={i}>
            <span className="seg-facility">{seg.facility ?? "Unknown type"}</span>
            {seg.label && seg.label !== feature.name && (
              <span className="seg-label">{seg.label}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
