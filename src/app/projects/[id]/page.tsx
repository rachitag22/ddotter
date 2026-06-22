import Link from "next/link";
import { notFound } from "next/navigation";
import { FeedbackForm } from "@/components/FeedbackForm";
import { ProjectAssets } from "@/components/ProjectAssets";
import { SegmentList } from "@/components/SegmentList";
import { sourceTypeLabel } from "@/lib/design";
import { getProject, getProjectAssets } from "@/lib/projects";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectDetail({ params }: PageProps) {
  const { id } = await params;
  const [project, assets] = await Promise.all([getProject(id), getProjectAssets(id)]);

  if (!project) notFound();

  return (
    <main className="detail-main">
      <Link className="back-link" href="/">
        ← Back to projects
      </Link>
      <article className="detail-panel">
        <div className="meta">
          <span className={`badge ${project.status}`}>{project.status}</span>
          <span className="badge">Ward {project.ward ?? "unknown"}</span>
          <span className="badge">
            {project.mode ?? sourceTypeLabel[project.source_type] ?? project.source_type}
          </span>
        </div>
        <h1>{project.name}</h1>
        <p>{project.description}</p>
        <SegmentList project={project} />
        <div className="project-grid">
          <section>
            <h2>Timeline</h2>
            <p>{project.timeline_start ?? "TBD"} — {project.timeline_end ?? "TBD"}</p>
          </section>
          <section>
            <h2>Estimated cost</h2>
            <p>{project.cost ? `$${project.cost.toLocaleString()}` : "TBD"}</p>
          </section>
          <section>
            <h2>Community signal</h2>
            <p>
              {project.feedback_count ?? 0} responses
              {project.support_percent ? `, ${project.support_percent}% support` : ""}
            </p>
          </section>
        </div>
        {project.official_url && (
          <a
            className="modal-ddot-link"
            href={project.official_url}
            rel="noopener noreferrer"
            target="_blank"
          >
            View on DDOT website ↗
          </a>
        )}
        <ProjectAssets assets={assets} />
        <FeedbackForm featureId={project.id} />
      </article>
    </main>
  );
}
