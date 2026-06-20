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

  const ENRICHABLE_TYPES = ["bike_lane", "capital_project", "trail_project"];
  const targetTypes = sourceTypeFilter
    ? ENRICHABLE_TYPES.filter((t) => t === sourceTypeFilter)
    : ENRICHABLE_TYPES;

  if (targetTypes.length === 0) {
    return NextResponse.json({ error: `Unknown source_type: ${sourceTypeFilter}` }, { status: 400 });
  }

  const supabase = getSupabaseSyncClient();

  const { data: records, error } = await supabase
    .from("features")
    .select("id, name, source_type, official_url, description, ward, mode, status, timeline_start, timeline_end, cost, raw")
    .in("source_type", targetTypes)
    .or("description.is.null,description.eq.")
    .order("source_type");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const allRecords = records ?? [];
  const byType: Record<string, number> = {};
  const results = [];
  let updated = 0;

  for (const record of allRecords) {
    byType[record.source_type] = (byType[record.source_type] ?? 0) + 1;
    const result = await enrichRecord(record);
    results.push(result);

    if (result.updated && result.description) {
      await supabase
        .from("features")
        .update({ description: result.description })
        .eq("id", record.id);
      updated++;
    }
  }

  return NextResponse.json({
    ok: true,
    records_seen: allRecords.length,
    records_seen_by_type: byType,
    records_updated: updated,
    results,
  });
}

export async function GET(request: Request) {
  return handleEnrich(request);
}

export async function POST(request: Request) {
  return handleEnrich(request);
}
