"use client";

import { useState } from "react";
import type { ProjectAsset } from "@/lib/types";

type Props = {
  assets: ProjectAsset[];
};

const LABELS: Record<string, string> = {
  document: "Documents",
  photo: "Photos",
  video: "Videos",
  map: "Maps",
  link: "Links",
};

const TYPE_ORDER = ["document", "map", "video", "photo", "link"];

function PhotoItem({ asset }: { asset: ProjectAsset }) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <a href={asset.url} target="_blank" rel="noopener noreferrer" className="asset-link">
        {asset.title || new URL(asset.url).hostname}
      </a>
    );
  }

  return (
    <a href={asset.url} target="_blank" rel="noopener noreferrer" className="photo-thumb-link">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset.url}
        alt={asset.title ?? ""}
        className="photo-thumb"
        onError={() => setBroken(true)}
        loading="lazy"
      />
    </a>
  );
}

export function ProjectAssets({ assets }: Props) {
  if (!assets.length) return null;

  const byType = new Map<string, ProjectAsset[]>();
  for (const asset of assets) {
    const list = byType.get(asset.asset_type) ?? [];
    list.push(asset);
    byType.set(asset.asset_type, list);
  }

  return (
    <div className="project-assets">
      {TYPE_ORDER.filter((t) => byType.has(t)).map((type) => (
        <section key={type} className="assets-section">
          <h3 className="assets-heading">{LABELS[type]}</h3>
          {type === "photo" ? (
            <div className="photo-grid">
              {byType.get(type)!.map((asset) => (
                <PhotoItem key={asset.id} asset={asset} />
              ))}
            </div>
          ) : (
            <ul className="assets-list">
              {byType.get(type)!.map((asset) => (
                <li key={asset.id} className="asset-item">
                  <a
                    href={asset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="asset-link"
                  >
                    {asset.title || new URL(asset.url).hostname}
                    {asset.file_type ? (
                      <span className="asset-badge">{asset.file_type.toUpperCase()}</span>
                    ) : null}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
