"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ProjectAssets } from "@/components/ProjectAssets";
import { sourceTypeLabel } from "@/lib/design";
import { buildCloseUrl, buildSelectedUrl } from "@/lib/url";
import type { ListProjectRecord, ProjectAsset, ProjectFilters } from "@/lib/types";

type DrawerState = "peek" | "half" | "full" | "preview";

function computeTranslateY(state: DrawerState, isDetail: boolean): number {
  if (typeof window === "undefined") return 0;
  const drawerH = window.innerHeight * 0.85;
  if (isDetail) {
    if (state === "preview") return drawerH - window.innerHeight / 3;
    return 0;
  }
  if (state === "peek") return drawerH - 72;
  if (state === "half") return drawerH - window.innerHeight * 0.5;
  return 0;
}

function snapFromTranslateY(ty: number, drawerH: number, isDetail: boolean): DrawerState {
  const visible = drawerH - ty;
  const ratio = visible / drawerH;
  if (isDetail) return ratio < 0.55 ? "preview" : "full";
  if (ratio < 0.25) return "peek";
  if (ratio < 0.7) return "half";
  return "full";
}

export function BottomDrawer({
  features,
  filters,
  selectedId,
  selectedFeature,
  selectedAssets = [],
}: {
  features: ListProjectRecord[];
  filters: ProjectFilters;
  selectedId?: string;
  selectedFeature?: ListProjectRecord | null;
  selectedAssets?: ProjectAsset[];
}) {
  const isDetail = !!selectedFeature;
  const [snapState, setSnapState] = useState<DrawerState>(isDetail ? "preview" : "peek");
  const drawerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startTranslate: number } | null>(null);
  const translateRef = useRef(0);

  function applySnap(newState: DrawerState, detail = isDetail) {
    const drawer = drawerRef.current;
    if (!drawer) return;
    drawer.style.transition = "";
    void drawer.offsetHeight;
    drawer.style.transform = "";
    translateRef.current = computeTranslateY(newState, detail);
    setSnapState(newState);
  }

  // Snap to the right state whenever the selected project changes
  useEffect(() => {
    applySnap(selectedFeature ? "preview" : "peek", !!selectedFeature);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFeature?.id]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const drawer = drawerRef.current;
    if (!drawer) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    translateRef.current = computeTranslateY(snapState, isDetail);
    drawer.style.transition = "none";
    dragRef.current = { startY: e.clientY, startTranslate: translateRef.current };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !drawerRef.current) return;
    const delta = e.clientY - dragRef.current.startY;
    const newTy = Math.max(0, dragRef.current.startTranslate + delta);
    drawerRef.current.style.transform = `translateY(${newTy}px)`;
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !drawerRef.current) return;
    const drawer = drawerRef.current;
    const delta = e.clientY - dragRef.current.startY;

    if (Math.abs(delta) < 8) {
      dragRef.current = null;
      if (isDetail) {
        applySnap(snapState === "preview" ? "full" : "preview");
      } else {
        applySnap(snapState === "peek" ? "half" : snapState === "half" ? "full" : "peek");
      }
      return;
    }

    const finalTy = Math.max(0, dragRef.current.startTranslate + delta);
    const newState = snapFromTranslateY(finalTy, drawer.offsetHeight, isDetail);
    dragRef.current = null;
    applySnap(newState);
  }

  const statusCounts = features.reduce<Record<string, number>>((acc, f) => {
    acc[f.status] = (acc[f.status] ?? 0) + 1;
    return acc;
  }, {});

  const closeUrl = buildCloseUrl(filters);

  return (
    <div className="drawer" data-mode={isDetail ? "detail" : "list"} data-state={snapState} ref={drawerRef}>
      {/* Drag handle */}
      <div
        className="drawer-handle"
        onPointerCancel={onPointerUp}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="drawer-pip" />
        <div className="drawer-header-row">
          {isDetail ? (
            <>
              <Link className="drawer-back" href={closeUrl}>← Back</Link>
              <button
                aria-label="Toggle detail"
                className="drawer-toggle"
                onClick={() => applySnap(snapState === "preview" ? "full" : "preview")}
                type="button"
              >
                {snapState === "full" ? "↓" : "↑"}
              </button>
            </>
          ) : (
            <>
              <span className="drawer-title">DDOT Advocacy Map</span>
              <span className="drawer-count">{features.length.toLocaleString()} projects</span>
              <button
                aria-label="Toggle project list"
                className="drawer-toggle"
                onClick={() => applySnap(snapState === "peek" ? "half" : snapState === "half" ? "full" : "peek")}
                type="button"
              >
                {snapState === "full" ? "↓" : "↑"}
              </button>
            </>
          )}
        </div>
        {!isDetail && (
          <div className="drawer-badges">
            {(statusCounts.planned ?? 0) > 0 && (
              <span className="badge planned">{statusCounts.planned} planned</span>
            )}
            {(statusCounts.active ?? 0) > 0 && (
              <span className="badge active">{statusCounts.active} active</span>
            )}
            {(statusCounts.complete ?? 0) > 0 && (
              <span className="badge complete">{statusCounts.complete} complete</span>
            )}
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div className="drawer-body">
        {isDetail ? (
          <div className="drawer-detail">
            <div className="meta">
              <span className={`badge ${selectedFeature.status}`}>{selectedFeature.status}</span>
              {selectedFeature.ward && <span className="badge">Ward {selectedFeature.ward}</span>}
              <span className="badge">
                {selectedFeature.mode ?? sourceTypeLabel[selectedFeature.source_type] ?? selectedFeature.source_type}
              </span>
            </div>
            <h2 className="drawer-detail-name">{selectedFeature.name}</h2>
            {selectedFeature.description && (
              <p className="drawer-detail-desc">{selectedFeature.description}</p>
            )}
            <div className="project-grid">
              <section>
                <h2>Timeline</h2>
                <p>{selectedFeature.timeline_start ?? "TBD"} — {selectedFeature.timeline_end ?? "TBD"}</p>
              </section>
              <section>
                <h2>Estimated cost</h2>
                <p>{selectedFeature.cost ? `$${selectedFeature.cost.toLocaleString()}` : "TBD"}</p>
              </section>
            </div>
            {selectedFeature.official_url && (
              <a
                className="drawer-ddot-link"
                href={selectedFeature.official_url}
                rel="noopener noreferrer"
                target="_blank"
              >
                View on DDOT website ↗
              </a>
            )}
            <ProjectAssets assets={selectedAssets} />
            <p className="drawer-permalink">
              <Link href={`/projects/${selectedFeature.id}`}>Permanent link ↗</Link>
            </p>
          </div>
        ) : (
          <>
            <form action="/" className="drawer-filters" method="get">
              <input
                className="filter-search"
                defaultValue={filters.q}
                name="q"
                placeholder="Search projects..."
              />
              <div className="filter-row">
                <select
                  className="filter-select"
                  defaultValue={filters.type ?? ""}
                  name="type"
                  onChange={(e) => (e.target.form as HTMLFormElement).requestSubmit()}
                >
                  <option value="">All types</option>
                  <option value="capital_project">Capital</option>
                  <option value="bike_lane">Bike lane</option>
                  <option value="trail_project">Trail</option>
                </select>
                <select
                  className="filter-select"
                  defaultValue={filters.ward ?? ""}
                  name="ward"
                  onChange={(e) => (e.target.form as HTMLFormElement).requestSubmit()}
                >
                  <option value="">All wards</option>
                  {Array.from({ length: 8 }, (_, i) => `${i + 1}`).map((w) => (
                    <option key={w} value={w}>
                      Ward {w}
                    </option>
                  ))}
                </select>
                <select
                  className="filter-select"
                  defaultValue={filters.status ?? ""}
                  name="status"
                  onChange={(e) => (e.target.form as HTMLFormElement).requestSubmit()}
                >
                  <option value="">All statuses</option>
                  <option value="active,planned">Active + Planned</option>
                  <option value="active">Active</option>
                  <option value="planned">Planned</option>
                  <option value="complete">Complete</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
            </form>

            <div className="project-list">
              {features.map((project) => (
                <article
                  className={`project-card${selectedId === project.id ? " selected" : ""}`}
                  key={project.id}
                >
                  <div className="meta">
                    <span className={`badge ${project.status}`}>{project.status}</span>
                    <span className="badge">Ward {project.ward ?? "?"}</span>
                    <span className="badge">
                      {project.mode ?? sourceTypeLabel[project.source_type] ?? project.source_type}
                    </span>
                  </div>
                  <h2>{project.name}</h2>
                  {project.description && <p className="card-desc">{project.description}</p>}
                  <Link className="link-button" href={buildSelectedUrl(project.id, filters)}>
                    View project →
                  </Link>
                </article>
              ))}
              {features.length === 0 && (
                <p className="empty-state">No projects match your filters.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
