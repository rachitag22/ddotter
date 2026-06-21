import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

const BATCH_SIZE = 50;

async function cleanBatch(labels: string[]): Promise<Map<string, string>> {
  const { text } = await generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    prompt: `Convert these DC bike lane segment labels from ALL CAPS ArcGIS format to clean, human-readable title case.

Rules:
- Street type abbreviations: St, Ave, Rd, Blvd, Dr, Pl, Ln, Ct, Ter
- Directional quadrant suffixes always uppercase: NW, NE, SE, SW
- Ordinals lowercase: 1st, 2nd, 3rd, 4th, 11th, etc.
- Use lowercase "to" between cross streets
- Keep the "Street Name: From St to To St" colon format intact
- Preserve bare block-number ranges like "6 to 7" as-is
- Do not add or remove any streets or change route names

Return ONLY a valid JSON object with no markdown fences, mapping each original label to its cleaned version:
{"ORIGINAL LABEL": "Cleaned label"}

Labels to clean (one per line):
${labels.join("\n")}`,
    maxOutputTokens: 2000,
  });

  const stripped = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const parsed = JSON.parse(stripped) as Record<string, string>;
  return new Map(Object.entries(parsed));
}

/**
 * Clean a list of raw ArcGIS segment labels to human-readable form using an LLM.
 * De-duplicates inputs and batches them. Falls back to original labels on error
 * or when ANTHROPIC_API_KEY is not configured.
 */
export async function cleanSegmentLabels(labels: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(labels.filter(Boolean))];
  if (!unique.length || !process.env.ANTHROPIC_API_KEY) return new Map();

  const result = new Map<string, string>();

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    try {
      const cleaned = await cleanBatch(batch);
      for (const [orig, clean] of cleaned) result.set(orig, clean);
    } catch {
      // Leave this batch with original labels; partial success is fine.
    }
  }

  return result;
}
