import { z } from "zod";
import { getSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase";

export const feedbackSchema = z.object({
  support: z.boolean(),
  comment: z.string().trim().min(3).max(1200),
  name: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
});

export async function getFeedbackAggregate(featureId: string) {
  if (!hasSupabaseConfig()) {
    return {
      feature_id: featureId,
      feedback_count: 0,
      support_count: 0,
      support_percent: 0,
    };
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("feedback")
    .select("support")
    .eq("feature_id", featureId);

  if (error) throw error;

  const feedbackCount = data?.length ?? 0;
  const supportCount = data?.filter((row) => row.support).length ?? 0;

  return {
    feature_id: featureId,
    feedback_count: feedbackCount,
    support_count: supportCount,
    support_percent: feedbackCount ? Math.round((supportCount / feedbackCount) * 100) : 0,
  };
}
