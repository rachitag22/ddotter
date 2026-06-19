import { NextResponse } from "next/server";
import { fetchArtInstallations, fetchBikeLanes, fetchCapitalProjects, fetchTrailProjects } from "@/lib/arcgis";
import { hasSupabaseConfig } from "@/lib/supabase";
import { getSupabaseSyncClient } from "@/lib/supabase";
import type { FeatureRecord, SourceType } from "@/lib/types";

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const values = Object.values(error as Record<string, unknown>)
      .filter((value) => typeof value === "string")
      .join(": ");
    return values || JSON.stringify(error);
  }
  return "Unknown sync error";
}

async function syncSource(sourceType: SourceType, getRecords: () => Promise<FeatureRecord[]>) {
  const startedAt = new Date().toISOString();
  const supabase = getSupabaseSyncClient();

  try {
    const records = await getRecords();

    if (records.length) {
      const { error } = await supabase.from("features").upsert(records, { onConflict: "id" });
      if (error) throw error;
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
    const message = errorMessage(error);

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
