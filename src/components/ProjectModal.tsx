"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SegmentList } from "@/components/SegmentList";
import { sourceTypeLabel } from "@/lib/design";
import { buildCloseUrl } from "@/lib/url";
import type { ProjectRecord } from "@/lib/types";

export function ProjectModal({
  project,
}: {
  project: ProjectRecord;
}) {
  const router = useRouter();
  const closeUrl = buildCloseUrl();

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) router.push(closeUrl); }}
    >
      <div className="modal-panel" aria-labelledby="modal-title" aria-modal="true" role="dialog">
        <div className="modal-header">
          <div className="meta">
            <span className={`badge ${project.status}`}>{project.status}</span>
            {project.ward && <span className="badge">Ward {project.ward}</span>}
            <span className="badge">
              {project.mode ?? sourceTypeLabel[project.source_type] ?? project.source_type}
            </span>
          </div>
          <Link aria-label="Close" className="modal-close" href={closeUrl}>✕</Link>
        </div>

        <h2 className="modal-title" id="modal-title">{project.name}</h2>
        {project.description && <p className="modal-desc">{project.description}</p>}
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

        <p className="modal-permalink">
          <Link href={`/projects/${project.id}`}>Permanent link ↗</Link>
        </p>
      </div>
    </div>
  );
}
