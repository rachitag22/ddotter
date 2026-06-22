import { NextResponse } from "next/server";
import { feedbackSchema, getFeedbackAggregate } from "@/lib/feedback";
import { getProject } from "@/lib/projects";
import { getSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;
  return NextResponse.json(await getFeedbackAggregate(id));
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = feedbackSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid feedback" }, { status: 400 });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json({ ok: true, persisted: false }, { status: 202 });
  }

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("feedback").insert({
    feature_id: id,
    support: parsed.data.support,
    comment: parsed.data.comment,
    name: parsed.data.name || null,
    email: parsed.data.email || null,
  });

  if (error) {
    return NextResponse.json({ error: "Could not save feedback" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, persisted: true }, { status: 201 });
}
