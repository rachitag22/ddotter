import { NextResponse } from "next/server";
import {
  fetchArtInstallations,
  fetchBikeLanes,
  fetchCapitalProjects,
  fetchTrailProjects,
  fetchArlingtonBikeLanes,
  fetchAlexandriaBikeLanes,
  fetchFairfaxBikeLanes,
  fetchVdotBikeLanes,
  fetchMontgomeryBikeLanes,
  fetchPgCountyBikeLanes,
  fetchMdotBikeLanes,
} from "@/lib/arcgis";
import { hasSupabaseConfig } from "@/lib/supabase";
import { getSupabaseSyncClient } from "@/lib/supabase";
import type { ProjectRecord, SourceType } from "@/lib/types";

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

async function preserveEnrichedDescriptions(
  supabase: ReturnType<typeof getSupabaseSyncClient>,
  records: ProjectRecord[],
) {
  const descriptions = new Map<string, string>();
  const chunkSize = 500;

  for (let i = 0; i < records.length; i += chunkSize) {
    const ids = records.slice(i, i + chunkSize).map((record) => record.id);
    const { data, error } = await supabase
      .from("projects")
      .select("id, description")
      .in("id", ids)
      .not("last_enriched_at", "is", null);

    if (error) throw error;
    for (const row of data ?? []) {
      if (row.description) descriptions.set(row.id, row.description);
    }
  }

  return records.map((record) => {
    const description = descriptions.get(record.id);
    return description ? { ...record, description } : record;
  });
}

async function syncSource(
  sourceType: SourceType,
  getRecords: () => Promise<ProjectRecord[]>,
  options?: { jurisdiction?: string },
) {
  const startedAt = new Date().toISOString();
  const supabase = getSupabaseSyncClient();

  try {
    const fetchedRecords = await getRecords();
    const dedupedRecords = Array.from(
      fetchedRecords.reduce((byId, record) => byId.set(record.id, record), new Map<string, ProjectRecord>()).values(),
    );
    const records = await preserveEnrichedDescriptions(supabase, dedupedRecords);

    if (records.length) {
      const { error: upsertError } = await supabase
        .from("projects")
        .upsert(records, { onConflict: "id" });
      if (upsertError) throw upsertError;

      // Delete stale records scoped to this source (and jurisdiction if provided).
      // Current records get a fresh synced_at, which avoids sending thousands of
      // IDs through a PostgREST filter for larger sources.
      const { error: deleteError } = options?.jurisdiction !== undefined
        ? await supabase
            .from("projects")
            .delete()
            .eq("source_type", sourceType)
            .eq("jurisdiction", options.jurisdiction)
            .lt("synced_at", startedAt)
        : await supabase
            .from("projects")
            .delete()
            .eq("source_type", sourceType)
            .lt("synced_at", startedAt);
      if (deleteError) throw deleteError;
    }

    await supabase.from("sync_log").insert({
      source_type: sourceType,
      status: "success",
      records_seen: fetchedRecords.length,
      records_upserted: records.length,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return {
      source_type: sourceType,
      status: "success",
      records_seen: fetchedRecords.length,
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

  const url = new URL(request.url);
  // LABEL_CLEAN_LIMIT: unset = 10 (safe default), -1 = unlimited
  const envLabelLimit = process.env.LABEL_CLEAN_LIMIT != null ? parseInt(process.env.LABEL_CLEAN_LIMIT, 10) : 10;
  const queryLabelLimit = url.searchParams.get("label_limit");
  const effectiveEnvLabel = envLabelLimit === -1 ? Infinity : envLabelLimit;
  const effectiveQueryLabel = queryLabelLimit == null ? Infinity : (parseInt(queryLabelLimit, 10) === -1 ? Infinity : parseInt(queryLabelLimit, 10));
  const resolvedLabelLimit = Math.min(effectiveEnvLabel, effectiveQueryLabel);
  const labelLimit = resolvedLabelLimit === Infinity ? undefined : resolvedLabelLimit;

  const [
    capitalProjects,
    bikeLanes,
    trailProjects,
    artInstallations,
    arlingtonLanes,
    alexandriaLanes,
    fairfaxLanes,
    vdotLanes,
    montgomeryLanes,
    pgCountyLanes,
    mdotLanes,
  ] = await Promise.all([
    syncSource("capital_project", fetchCapitalProjects),
    syncSource("bike_lane", () => fetchBikeLanes({ labelLimit }), { jurisdiction: "dc" }),
    syncSource("trail_project", fetchTrailProjects),
    syncSource("art_installation", fetchArtInstallations),
    syncSource("bike_lane", fetchArlingtonBikeLanes,  { jurisdiction: "arlington"  }),
    syncSource("bike_lane", fetchAlexandriaBikeLanes, { jurisdiction: "alexandria" }),
    syncSource("bike_lane", fetchFairfaxBikeLanes,    { jurisdiction: "fairfax"    }),
    syncSource("bike_lane", fetchVdotBikeLanes,       { jurisdiction: "vdot"       }),
    syncSource("bike_lane", fetchMontgomeryBikeLanes, { jurisdiction: "montgomery" }),
    syncSource("bike_lane", fetchPgCountyBikeLanes,   { jurisdiction: "pgcounty"   }),
    syncSource("bike_lane", fetchMdotBikeLanes,       { jurisdiction: "mdot"       }),
  ]);
  const sources = [
    capitalProjects, bikeLanes, trailProjects, artInstallations,
    arlingtonLanes, alexandriaLanes, fairfaxLanes, vdotLanes,
    montgomeryLanes, pgCountyLanes, mdotLanes,
  ];

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
