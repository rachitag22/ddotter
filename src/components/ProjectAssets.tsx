import type { ProjectAsset } from "@/lib/types";

type Props = {
  assets: ProjectAsset[];
};

const ICONS: Record<string, string> = {
  document: "📄",
  photo: "🖼",
  video: "▶",
  map: "🗺",
  link: "🔗",
};

const LABELS: Record<string, string> = {
  document: "Documents",
  photo: "Photos",
  video: "Videos",
  map: "Maps",
  link: "Links",
};

const TYPE_ORDER = ["document", "map", "video", "photo", "link"];

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
          <h3 className="assets-heading">
            {ICONS[type]} {LABELS[type]}
          </h3>
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
        </section>
      ))}
    </div>
  );
}
