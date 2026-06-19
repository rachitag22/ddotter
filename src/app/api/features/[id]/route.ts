import { NextResponse } from "next/server";
import { getFeature } from "@/lib/features";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const feature = await getFeature(id);

  if (!feature) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }

  return NextResponse.json({ feature });
}
