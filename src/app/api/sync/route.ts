import { NextResponse } from "next/server";
import { hasSupabaseConfig } from "@/lib/supabase";

async function handleSync(request: Request) {
  const expectedSecret = process.env.SYNC_SECRET || process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const providedSecret = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;

  if (expectedSecret && providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    configured: hasSupabaseConfig(),
    sources: [
      {
        source_type: "capital_project",
        status: "pending_adapter",
        records_seen: 0,
        records_upserted: 0,
      },
      {
        source_type: "trail_project",
        status: "pending_adapter",
        records_seen: 0,
        records_upserted: 0,
      },
      {
        source_type: "art_installation",
        status: "endpoint_tbd",
        records_seen: 0,
        records_upserted: 0,
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
