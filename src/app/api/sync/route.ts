import { NextResponse } from "next/server";
import { fetchArtInstallations, fetchBikeLanes, fetchCapitalProjects, fetchTrailProjects } from "@/lib/arcgis";
import { hasSupabaseConfig } from "@/lib/supabase";
import { getSupabaseSyncClient } from "@/lib/supabase";
import type { FeatureRecord, SourceType } from "@/lib/types";

async function syncSource(sourceType: SourceType, getRecords: () => Promise<FeatureRecord[]>) {
  const startedAt = new Date().toISOString();
  const supabase = getSupabaseSyncClient();

  try {
    const records = await getRecords();

    if (records.length) {
      const { error: upsertError } = await supabase
        .from("features")
        .upsert(records, { onConflict: "id" });
      if (upsertError) throw upsertError;

      // Delete any stale records for this source that are no longer in the
      // upstream data (e.g. old per-segment bike lane IDs after grouping).
      const currentIds = records.map((r) => r.id);
      const { error: deleteError } = await supabase
        .from("features")
        .delete()
        .eq("source_type", sourceType)
        .not("id", "in", `(${currentIds.map((id) => `"${id}"`).join(",")})`);
      if (deleteError) throw deleteError;
    }

    await supabase.from("sync_log").insert({
      source_type: sourceType,
      status: "success",
      records_seen: records.length,
      records_upserted: records.length,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return {
      source_type: sourceType,
      status: "success",
      records_seen: records.length,
      records_upserted: records.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";

    await supabase.from("sync_log").insert({
      source_type: sourceType,
      status: "error",
      records_seen: 0,
      records_upserted: 0,
      error_message: message,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return {
      source_type: sourceType,
      status: "error",
      records_seen: 0,
      records_upserted: 0,
      error_message: message,
    };
  }
}

async function handleSync(request: Request) {
  const expectedSecret = process.env.SYNC_SECRET || process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const providedSecret = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;

  if (expectedSecret && providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const capitalProjects = await syncSource("capital_project", fetchCapitalProjects);
  const bikeLanes = await syncSource("bike_lane", fetchBikeLanes);
  const trailProjects = await syncSource("trail_project", fetchTrailProjects);
  const artInstallations = await syncSource("art_installation", fetchArtInstallations);
  const sources = [capitalProjects, bikeLanes, trailProjects, artInstallations];

  return NextResponse.json({
    ok: sources.every((source) => source.status === "success"),
    sources,
  });
}

export async function GET(request: Request) {
  return handleSync(request);
}

export async function POST(request: Request) {
  return handleSync(request);
}
