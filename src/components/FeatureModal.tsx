"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FeedbackForm } from "@/components/FeedbackForm";
import { SegmentList } from "@/components/SegmentList";
import { sourceTypeLabel } from "@/lib/design";
import { buildCloseUrl } from "@/lib/url";
import type { FeatureFilters, FeatureRecord } from "@/lib/types";

export function FeatureModal({
  feature,
  filters,
}: {
  feature: FeatureRecord;
  filters: FeatureFilters;
}) {
  const router = useRouter();
  const closeUrl = buildCloseUrl(filters);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) router.push(closeUrl); }}
    >
      <div className="modal-panel" aria-labelledby="modal-title" aria-modal="true" role="dialog">
        <div className="modal-header">
          <div className="meta">
            <span className={`badge ${feature.status}`}>{feature.status}</span>
            {feature.ward && <span className="badge">Ward {feature.ward}</span>}
            <span className="badge">
              {feature.mode ?? sourceTypeLabel[feature.source_type] ?? feature.source_type}
            </span>
          </div>
          <Link aria-label="Close" className="modal-close" href={closeUrl}>✕</Link>
        </div>

        <h2 className="modal-title" id="modal-title">{feature.name}</h2>
        {feature.description && <p className="modal-desc">{feature.description}</p>}
        <SegmentList feature={feature} />

        <div className="project-grid">
          <section>
            <h2>Timeline</h2>
            <p>{feature.timeline_start ?? "TBD"} — {feature.timeline_end ?? "TBD"}</p>
          </section>
          <section>
            <h2>Estimated cost</h2>
            <p>{feature.cost ? `$${feature.cost.toLocaleString()}` : "TBD"}</p>
          </section>
          <section>
            <h2>Community signal</h2>
            <p>
              {feature.feedback_count ?? 0} responses
              {feature.support_percent ? `, ${feature.support_percent}% support` : ""}
            </p>
          </section>
        </div>

        {feature.official_url && (
          <a
            className="modal-ddot-link"
            href={feature.official_url}
            rel="noopener noreferrer"
            target="_blank"
          >
            View on DDOT website ↗
          </a>
        )}

        <FeedbackForm featureId={feature.id} />

        <p className="modal-permalink">
          <Link href={`/features/${feature.id}`}>Permanent link ↗</Link>
        </p>
      </div>
    </div>
  );
}
