"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { sourceTypeLabel } from "@/lib/design";
import { buildSelectedUrl } from "@/lib/url";
import type { FeatureRecord, FeatureFilters } from "@/lib/types";

type DrawerState = "peek" | "half" | "full";

function computeTranslateY(state: DrawerState): number {
  if (typeof window === "undefined") return 0;
  const drawerH = window.innerHeight * 0.85;
  if (state === "peek") return drawerH - 72;
  if (state === "half") return drawerH - window.innerHeight * 0.5;
  return 0;
}

function snapFromTranslateY(ty: number, drawerH: number): DrawerState {
  const visible = drawerH - ty;
  const ratio = visible / drawerH;
  if (ratio < 0.25) return "peek";
  if (ratio < 0.7) return "half";
  return "full";
}

function cycleState(s: DrawerState): DrawerState {
  return s === "peek" ? "half" : s === "half" ? "full" : "peek";
}

export function BottomDrawer({
  features,
  filters,
  selectedId,
}: {
  features: FeatureRecord[];
  filters: FeatureFilters;
  selectedId?: string;
}) {
  const [snapState, setSnapState] = useState<DrawerState>("peek");
  const drawerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startTranslate: number } | null>(null);
  const translateRef = useRef(0);

  function applySnap(newState: DrawerState) {
    const drawer = drawerRef.current;
    if (!drawer) return;
    // Re-enable CSS transition, force reflow, then let CSS class take over
    drawer.style.transition = "";
    void drawer.offsetHeight;
    drawer.style.transform = "";
    translateRef.current = computeTranslateY(newState);
    setSnapState(newState);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const drawer = drawerRef.current;
    if (!drawer) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    translateRef.current = computeTranslateY(snapState);
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
      // Tap: cycle state
      dragRef.current = null;
      applySnap(cycleState(snapState));
      return;
    }

    const finalTy = Math.max(0, dragRef.current.startTranslate + delta);
    const newState = snapFromTranslateY(finalTy, drawer.offsetHeight);
    dragRef.current = null;
    applySnap(newState);
  }

  const statusCounts = features.reduce<Record<string, number>>((acc, f) => {
    acc[f.status] = (acc[f.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="drawer" data-state={snapState} ref={drawerRef}>
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
          <span className="drawer-title">DDOT Advocacy Map</span>
          <span className="drawer-count">{features.length.toLocaleString()} projects</span>
          <button
            aria-label="Toggle project list"
            className="drawer-toggle"
            onClick={() => applySnap(cycleState(snapState))}
            type="button"
          >
            {snapState === "full" ? "↓" : "↑"}
          </button>
        </div>
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
      </div>

      {/* Scrollable body */}
      <div className="drawer-body">
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
              <option value="art_installation">Art / memorial</option>
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
              <option value="active">Active</option>
              <option value="planned">Planned</option>
              <option value="complete">Complete</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
        </form>

        <div className="project-list">
          {features.map((feature) => (
            <article
              className={`project-card${selectedId === feature.id ? " selected" : ""}`}
              key={feature.id}
            >
              <div className="meta">
                <span className={`badge ${feature.status}`}>{feature.status}</span>
                <span className="badge">Ward {feature.ward ?? "?"}</span>
                <span className="badge">
                  {feature.mode ?? sourceTypeLabel[feature.source_type] ?? feature.source_type}
                </span>
              </div>
              <h2>{feature.name}</h2>
              {feature.description && <p className="card-desc">{feature.description}</p>}
              <p className="feedback-stat">
                {feature.feedback_count ?? 0} responses
                {feature.support_percent ? `, ${feature.support_percent}% support` : ""}
              </p>
              <Link className="link-button" href={buildSelectedUrl(feature.id, filters)}>
                View project →
              </Link>
            </article>
          ))}
          {features.length === 0 && (
            <p className="empty-state">No projects match your filters.</p>
          )}
        </div>
      </div>
    </div>
  );
}
