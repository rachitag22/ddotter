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

  const supabase = getSupabaseSyncClient();

  // Fetch bike_lane records that have an official_url but no description yet
  const { data: records, error } = await supabase
    .from("features")
    .select("id, name, source_type, official_url, description")
    .eq("source_type", "bike_lane")
    .not("official_url", "is", null)
    .or("description.is.null,description.eq.");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];
  let updated = 0;

  for (const record of records ?? []) {
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
    records_seen: records?.length ?? 0,
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
