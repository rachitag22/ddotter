import { NextResponse } from "next/server";
import { getSupabaseSyncClient, hasSupabaseConfig } from "@/lib/supabase";
import { enrichRecord } from "@/lib/enrich";

async function handleEnrich(request: Request) {
  const expectedSecret = process.env.SYNC_SECRET || process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const providedSecret = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;

  if (expectedSecret && providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  const url = new URL(request.url);
  const sourceTypeFilter = url.searchParams.get("source_type");
  const idFilter = url.searchParams.get("id");
  const force = url.searchParams.get("force") === "true";
  // ENRICH_LIMIT: unset = 10 (safe default), -1 = unlimited
  const envLimit = process.env.ENRICH_LIMIT != null ? parseInt(process.env.ENRICH_LIMIT, 10) : 10;
  const queryLimitParam = url.searchParams.get("limit");
  const effectiveEnv = envLimit === -1 ? Infinity : envLimit;
  const effectiveQuery = queryLimitParam == null ? Infinity : (parseInt(queryLimitParam, 10) === -1 ? Infinity : parseInt(queryLimitParam, 10));
  const resolvedLimit = Math.min(effectiveEnv, effectiveQuery);
  const limit = resolvedLimit === Infinity ? undefined : resolvedLimit;

  const ENRICHABLE_TYPES = ["bike_lane", "capital_project", "trail_project"];
  const targetTypes = sourceTypeFilter
    ? ENRICHABLE_TYPES.filter((t) => t === sourceTypeFilter)
    : ENRICHABLE_TYPES;

  if (targetTypes.length === 0) {
    return NextResponse.json({ error: `Unknown source_type: ${sourceTypeFilter}` }, { status: 400 });
  }

  const supabase = getSupabaseSyncClient();

  let query = supabase
    .from("projects")
    .select("id, name, source_type, official_url, description, ward, mode, status, timeline_start, timeline_end, cost, raw, last_enrichment_attempted_at")
    .in("source_type", targetTypes)
    .order("source_type");

  if (!force) {
    query = query.is("last_enrichment_attempted_at", null);
  }
  if (idFilter) {
    query = query.eq("id", idFilter);
  }

  const { data: records, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const allRecords = (records ?? []).slice(0, limit);
  const byType: Record<string, number> = {};
  const results = [];
  let updated = 0;

  const CONCURRENCY = 10;
  for (let i = 0; i < allRecords.length; i += CONCURRENCY) {
    const batch = allRecords.slice(i, i + CONCURRENCY);
    for (const r of batch) byType[r.source_type] = (byType[r.source_type] ?? 0) + 1;

    const batchResults = await Promise.all(batch.map(enrichRecord));
    results.push(...batchResults);

    const toUpdate = batchResults.filter((r) => r.updated && r.description);
    updated += toUpdate.length;
    await Promise.all(
      batchResults.map((r) => {
        const now = new Date().toISOString();
        const patch = {
          last_enrichment_attempted_at: now,
          last_enriched_at: r.updated && r.description ? now : null,
          enrichment_error: r.error ?? null,
          ...(r.updated && r.description ? { description: r.description } : {}),
        };
        return supabase.from("projects").update(patch).eq("id", r.id);
      }),
    );
  }

  return NextResponse.json({
    ok: true,
    records_seen: allRecords.length,
    records_seen_by_type: byType,
    records_updated: updated,
    force,
    id: idFilter,
    results,
  });
}

export async function GET(request: Request) {
  return handleEnrich(request);
}

export async function POST(request: Request) {
  return handleEnrich(request);
}
