import { NextResponse } from "next/server";
import { fetchCapitalProjects } from "@/lib/arcgis";
import { hasSupabaseConfig } from "@/lib/supabase";
import { getSupabaseServerClient } from "@/lib/supabase";
import type { FeatureRecord, SourceType } from "@/lib/types";

async function syncSource(sourceType: SourceType, getRecords: () => Promise<FeatureRecord[]>) {
  const startedAt = new Date().toISOString();
  const supabase = getSupabaseServerClient();

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

  return NextResponse.json({
    ok: capitalProjects.status === "success",
    sources: [
      capitalProjects,
      {
        source_type: "trail_project",
        status: "error",
        records_seen: 0,
        records_upserted: 0,
        error_message: "DDOT/Trails FeatureServer endpoint is not available in the current DCGIS catalog.",
      },
      {
        source_type: "art_installation",
        status: "error",
        records_seen: 0,
        records_upserted: 0,
        error_message: "Art installation endpoint is still TBD.",
      },
    ],
  });
}

export async function GET(request: Request) {
  return handleSync(request);
}

export async function POST(request: Request) {
  return handleSync(request);
}
