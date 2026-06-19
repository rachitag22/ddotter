import Link from "next/link";
import { notFound } from "next/navigation";
import { FeedbackForm } from "@/components/FeedbackForm";
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
      <Link href="/">Back to projects</Link>
      <article className="detail-panel">
        <div className="meta">
          <span className={`badge ${feature.status}`}>{feature.status}</span>
          <span className="badge">Ward {feature.ward ?? "unknown"}</span>
          <span className="badge">{feature.mode ?? feature.source_type}</span>
        </div>
        <h1>{feature.name}</h1>
        <p>{feature.description}</p>
        <div className="project-grid">
          <section>
            <h2>Timeline</h2>
            <p>
              {feature.timeline_start ?? "TBD"} to {feature.timeline_end ?? "TBD"}
            </p>
          </section>
          <section>
            <h2>Estimated cost</h2>
            <p>{feature.cost ? `$${feature.cost.toLocaleString()}` : "TBD"}</p>
          </section>
          <section>
            <h2>Community signal</h2>
            <p>
              {feature.feedback_count ?? 0} comments
              {feature.support_percent ? `, ${feature.support_percent}% support` : ""}
            </p>
          </section>
        </div>
        <FeedbackForm featureId={feature.id} />
      </article>
    </main>
  );
}
