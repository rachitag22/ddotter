import Link from "next/link";
import { getFeatures } from "@/lib/features";
import type { FeatureRecord } from "@/lib/types";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function markerPosition(feature: FeatureRecord, index: number) {
  const [lng, lat] =
    feature.geometry.type === "Point" ? feature.geometry.coordinates : feature.geometry.coordinates[0];
  const left = Math.min(88, Math.max(8, ((lng + 77.08) / 0.18) * 100));
  const top = Math.min(82, Math.max(10, ((38.98 - lat) / 0.18) * 100));
  return { left: `${left || 18 + index * 17}%`, top: `${top || 18 + index * 13}%` };
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = {
    type: first(params.type),
    ward: first(params.ward),
    status: first(params.status),
    q: first(params.q),
  };
  const features = await getFeatures(filters);
  const statusCounts = features.reduce<Record<string, number>>((counts, feature) => {
    counts[feature.status] = (counts[feature.status] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <h1>DDOT Advocacy Map</h1>
          <p>Find active DC transportation projects and send useful feedback.</p>
        </div>
        <nav className="nav" aria-label="Primary">
          <a href="#map">Map</a>
          <a href="#projects">List</a>
        </nav>
      </header>

      <main className="main">
        <aside className="panel">
          <form className="filters">
            <label>
              Search
              <input defaultValue={filters.q} name="q" placeholder="Bike lane, trail, ward..." />
            </label>
            <label>
              Project type
              <select defaultValue={filters.type ?? ""} name="type">
                <option value="">All types</option>
                <option value="capital_project">Capital projects</option>
                <option value="trail_project">Trail projects</option>
                <option value="art_installation">Art installations</option>
              </select>
            </label>
            <label>
              Ward
              <select defaultValue={filters.ward ?? ""} name="ward">
                <option value="">All wards</option>
                {Array.from({ length: 8 }, (_, index) => `${index + 1}`).map((ward) => (
                  <option key={ward} value={ward}>
                    Ward {ward}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select defaultValue={filters.status ?? ""} name="status">
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="planned">Planned</option>
                <option value="complete">Complete</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>
            <button type="submit">Apply filters</button>
          </form>
          <div className="filter-summary">
            <strong>{features.length.toLocaleString()}</strong> projects shown
            <span>{statusCounts.planned ?? 0} planned</span>
            <span>{statusCounts.active ?? 0} active</span>
            <span>{statusCounts.complete ?? 0} complete</span>
          </div>
        </aside>

        <section className="content">
          <section className="map" id="map" aria-label="Project map preview">
            <div className="map-line" />
            {features.map((feature, index) => (
              <Link
                aria-label={feature.name}
                className={`marker ${feature.source_type}`}
                href={`/features/${feature.id}`}
                key={feature.id}
                style={markerPosition(feature, index)}
              >
                <span className="marker-label">{feature.name}</span>
              </Link>
            ))}
          </section>

          <section id="projects">
            <div className="project-grid">
              {features.map((feature) => (
                <article className="project-card" key={feature.id}>
                  <div className="meta">
                    <span className={`badge ${feature.status}`}>{feature.status}</span>
                    <span className="badge">Ward {feature.ward ?? "unknown"}</span>
                    <span className="badge">{feature.mode ?? feature.source_type}</span>
                  </div>
                  <h2>{feature.name}</h2>
                  <p>{feature.description}</p>
                  <p className="feedback-stat">
                    {feature.feedback_count ?? 0} neighbors weighed in
                    {feature.support_percent ? `, ${feature.support_percent}% support` : ""}
                  </p>
                  <Link className="link-button" href={`/features/${feature.id}`}>
                    View project
                  </Link>
                </article>
              ))}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
