import { NextRequest, NextResponse } from "next/server";
import { getFeatures, getFiltersFromSearchParams, toGeoJson } from "@/lib/features";

export async function GET(request: NextRequest) {
  const features = await getFeatures(getFiltersFromSearchParams(request.nextUrl.searchParams));
  return NextResponse.json(toGeoJson(features));
}
