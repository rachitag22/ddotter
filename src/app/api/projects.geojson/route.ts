import { NextRequest, NextResponse } from "next/server";
import { getProjects, getFiltersFromSearchParams, toGeoJson } from "@/lib/projects";

export async function GET(request: NextRequest) {
  const projects = await getProjects(getFiltersFromSearchParams(request.nextUrl.searchParams));
  return NextResponse.json(toGeoJson(projects));
}
