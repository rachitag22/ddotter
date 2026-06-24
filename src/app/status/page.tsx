import Link from "next/link";
import { getSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase";

type SourceStats = {
  source_type: string;
  total: number;
  with_description: number;
  with_assets: number;
  last_synced: string | null;
};

async function getStats(): Promise<SourceStats[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = getSupabaseServerClient();

  const [{ data: projects }, { data: assetRows }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, source_type, description, synced_at")
      .in("source_type", ["bike_lane", "trail_project"]),
    supabase
      .from("project_assets")
      .select("project_id"),
  ]);

  const projectRows = (projects ?? []) as {
    id: string;
    source_type: string;
    description: string | null;
    synced_at: string | null;
  }[];

  const projectsWithAssets = new Set((assetRows ?? []).map((r) => r.project_id as string));

  const byType = new Map<string, SourceStats>();

  for (const p of projectRows) {
    const key = p.source_type;
    if (!byType.has(key)) {
      byType.set(key, { source_type: key, total: 0, with_description: 0, with_assets: 0, last_synced: null });
    }
    const stat = byType.get(key)!;
    stat.total++;
    if (p.description) stat.with_description++;
    if (projectsWithAssets.has(p.id)) stat.with_assets++;
    if (p.synced_at && (!stat.last_synced || p.synced_at > stat.last_synced)) {
      stat.last_synced = p.synced_at;
    }
  }

  return Array.from(byType.values()).sort((a, b) => a.source_type.localeCompare(b.source_type));
}

function pct(n: number, d: number) {
  if (d === 0) return 0;
  return Math.round((n / d) * 100);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const SOURCE_LABEL: Record<string, string> = {
  bike_lane: "Bike lanes",
  trail_project: "Trail projects",
};

export default async function StatusPage() {
  const stats = await getStats();

  const totals = stats.reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      enriched: acc.enriched + s.with_description,
      scraped: acc.scraped + s.with_assets,
    }),
    { total: 0, enriched: 0, scraped: 0 },
  );

  return (
    <main className="status-main">
      <Link className="back-link" href="/">← Back to map</Link>
      <h1>Data status</h1>
      <p className="status-subtitle">Coverage across synced DDOT projects</p>

      <div className="status-grid">
        <div className="status-card">
          <p className="status-card-label">Total projects</p>
          <p className="status-card-value">{totals.total.toLocaleString()}</p>
        </div>
        <div className="status-card">
          <p className="status-card-label">Descriptions</p>
          <p className="status-card-value">{pct(totals.enriched, totals.total)}%</p>
          <p className="status-card-sub">{totals.enriched.toLocaleString()} of {totals.total.toLocaleString()}</p>
        </div>
        <div className="status-card">
          <p className="status-card-label">Assets scraped</p>
          <p className="status-card-value">{pct(totals.scraped, totals.total)}%</p>
          <p className="status-card-sub">{totals.scraped.toLocaleString()} projects with assets</p>
        </div>
      </div>

      <h2 className="status-section-title">By source type</h2>
      <table className="status-table">
        <thead>
          <tr>
            <th>Source</th>
            <th>Projects</th>
            <th>Descriptions</th>
            <th>Assets</th>
            <th>Last synced</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.source_type}>
              <td>{SOURCE_LABEL[s.source_type] ?? s.source_type}</td>
              <td>{s.total}</td>
              <td>
                <div className="status-bar-wrap">
                  <div className="status-bar">
                    <div className="status-bar-fill" style={{ width: `${pct(s.with_description, s.total)}%` }} />
                  </div>
                  <span>{pct(s.with_description, s.total)}%</span>
                </div>
              </td>
              <td>
                <div className="status-bar-wrap">
                  <div className="status-bar">
                    <div className="status-bar-fill" style={{ width: `${pct(s.with_assets, s.total)}%` }} />
                  </div>
                  <span>{pct(s.with_assets, s.total)}%</span>
                </div>
              </td>
              <td>{fmtDate(s.last_synced)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
