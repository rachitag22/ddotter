import Link from "next/link";
import { notFound } from "next/navigation";
import { FeedbackForm } from "@/components/FeedbackForm";
import { SegmentList } from "@/components/SegmentList";
import { sourceTypeLabel } from "@/lib/design";
import { getFeature } from "@/lib/features";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function FeatureDetail({ params }: PageProps) {
  const { id } = await params;
  const feature = await getFeature(id);

  if (!feature) notFound();

  return (
    <main className="detail-main">
      <Link className="back-link" href="/">
        ← Back to projects
      </Link>
      <article className="detail-panel">
        <div className="meta">
          <span className={`badge ${feature.status}`}>{feature.status}</span>
          <span className="badge">Ward {feature.ward ?? "unknown"}</span>
          <span className="badge">
            {feature.mode ?? sourceTypeLabel[feature.source_type] ?? feature.source_type}
          </span>
        </div>
        <h1>{feature.name}</h1>
        <p>{feature.description}</p>
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
      </article>
    </main>
  );
}
