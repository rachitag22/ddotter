import { NextResponse } from "next/server";
import { getSupabaseSyncClient, hasSupabaseConfig } from "@/lib/supabase";
import {
  fetchBikeLaneInventory,
  fetchExistingTrails,
  fetchPlannedTrails,
} from "@/lib/arcgis-bike-network";
import type { BikeSegment, BikeNetworkSource } from "@/lib/types";

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return JSON.stringify(error);
}

async function syncBikeSource(source: BikeNetworkSource, fetch: () => Promise<BikeSegment[]>) {
  const startedAt = new Date().toISOString();
  const supabase = getSupabaseSyncClient();

  try {
    const records = await fetch();

    // Dedup by id (last write wins)
    const deduped = Array.from(
      records.reduce((m, r) => m.set(r.id, r), new Map<string, BikeSegment>()).values(),
    );

    if (deduped.length) {
      const { error: upsertError } = await supabase
        .from("bike_network")
        .upsert(deduped, { onConflict: "id" });
      if (upsertError) throw upsertError;

      // Delete stale records for this source
      const { error: deleteError } = await supabase
        .from("bike_network")
        .delete()
        .eq("source", source)
        .lt("synced_at", startedAt);
      if (deleteError) throw deleteError;
    }

    await supabase.from("sync_log").insert({
      source_type: source,
      status: "success",
      records_seen: records.length,
      records_upserted: deduped.length,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return { source, status: "success", records_seen: records.length, records_upserted: deduped.length };
  } catch (error) {
    const message = errorMessage(error);
    await supabase.from("sync_log").insert({
      source_type: source,
      status: "error",
      records_seen: 0,
      records_upserted: 0,
      error_message: message,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });
    return { source, status: "error", records_seen: 0, records_upserted: 0, error_message: message };
  }
}

async function handleSync(request: Request) {
  const expectedSecret = process.env.SYNC_SECRET || process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const provided = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (expectedSecret && provided !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const url = new URL(request.url);
  const only = url.searchParams.get("only"); // optional: run a single source

  const sources: [BikeNetworkSource, () => Promise<BikeSegment[]>][] = [
    ["bike_lane_inventory", fetchBikeLaneInventory],
    ["bike_trail",          fetchExistingTrails],
    ["planned_trail",       fetchPlannedTrails],
  ];

  const filtered = only ? sources.filter(([s]) => s === only) : sources;

  const results = await Promise.all(filtered.map(([source, fetch]) => syncBikeSource(source, fetch)));

  return NextResponse.json({
    ok: results.every((r) => r.status === "success"),
    sources: results,
  });
}

export const GET  = (req: Request) => handleSync(req);
export const POST = (req: Request) => handleSync(req);
