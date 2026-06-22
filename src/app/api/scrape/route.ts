import { NextResponse } from "next/server";
import { getSupabaseSyncClient, hasSupabaseConfig } from "@/lib/supabase";
import { scrapeProjectPage } from "@/lib/scrape";

async function handleScrape(request: Request) {
  const expectedSecret = process.env.SYNC_SECRET || process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const providedSecret = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;

  if (expectedSecret && providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const url = new URL(request.url);
  const sourceTypeFilter = url.searchParams.get("source_type");
  const idFilter = url.searchParams.get("id");
  const force = url.searchParams.get("force") === "true";

  // SCRAPE_LIMIT: unset = 5 (safe default), -1 = unlimited
  const envLimit = process.env.SCRAPE_LIMIT != null ? parseInt(process.env.SCRAPE_LIMIT, 10) : 5;
  const queryLimitParam = url.searchParams.get("limit");
  const effectiveEnv = envLimit === -1 ? Infinity : envLimit;
  const effectiveQuery = queryLimitParam == null ? Infinity : (parseInt(queryLimitParam, 10) === -1 ? Infinity : parseInt(queryLimitParam, 10));
  const resolvedLimit = Math.min(effectiveEnv, effectiveQuery);
  const limit = resolvedLimit === Infinity ? undefined : resolvedLimit;

  const SCRAPEABLE_TYPES = ["bike_lane", "capital_project", "trail_project"];
  const targetTypes = sourceTypeFilter
    ? SCRAPEABLE_TYPES.filter((t) => t === sourceTypeFilter)
    : ["bike_lane"];

  if (targetTypes.length === 0) {
    return NextResponse.json({ error: `Unknown source_type: ${sourceTypeFilter}` }, { status: 400 });
  }

  const supabase = getSupabaseSyncClient();

  let query = supabase
    .from("projects")
    .select("id, name, official_url")
    .in("source_type", targetTypes)
    .not("official_url", "is", null)
    .order("synced_at", { ascending: false });

  if (idFilter) {
    query = query.eq("id", idFilter);
  }

  const { data: allProjects, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let projects = allProjects ?? [];

  // Unless forced, skip projects that already have assets
  if (!force && projects.length > 0) {
    const { data: scraped } = await supabase
      .from("project_assets")
      .select("project_id")
      .in("project_id", projects.map((p) => p.id));

    const scrapedIds = new Set((scraped ?? []).map((r) => r.project_id));
    projects = projects.filter((p) => !scrapedIds.has(p.id));
  }

  projects = projects.slice(0, limit);

  const errors: { id: string; error: string }[] = [];
  let projectsUpdated = 0;
  let assetsUpserted = 0;

  // Concurrency: 3 (polite to DDOT servers)
  const CONCURRENCY = 3;
  for (let i = 0; i < projects.length; i += CONCURRENCY) {
    const batch = projects.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (project) => {
        try {
          const assets = await scrapeProjectPage({
            id: project.id,
            official_url: project.official_url as string,
          });
          // Delete stale assets before inserting fresh ones so removed
          // nav/footer links don't persist across re-scrapes.
          const { error: deleteError } = await supabase
            .from("project_assets")
            .delete()
            .eq("project_id", project.id);
          if (deleteError) throw deleteError;
          if (assets.length > 0) {
            const { error: insertError } = await supabase
              .from("project_assets")
              .insert(assets.map((a) => ({ ...a, scraped_at: new Date().toISOString() })));
            if (insertError) throw insertError;
          }
          return { id: project.id, count: assets.length, error: null };
        } catch (err) {
          return {
            id: project.id,
            count: 0,
            error: err instanceof Error ? err.message : "unknown",
          };
        }
      }),
    );

    for (const r of results) {
      if (r.error) {
        errors.push({ id: r.id, error: r.error });
      } else {
        projectsUpdated++;
        assetsUpserted += r.count;
      }
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    projects_seen: projects.length,
    projects_updated: projectsUpdated,
    assets_upserted: assetsUpserted,
    errors,
  });
}

export async function GET(request: Request) {
  return handleScrape(request);
}

export async function POST(request: Request) {
  return handleScrape(request);
}
