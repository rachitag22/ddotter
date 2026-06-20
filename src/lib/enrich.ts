import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

/**
 * Fetch a URL and strip it to plain text suitable for an LLM prompt.
 * Returns null on network error or non-200.
 */
export async function fetchPageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "DDOT Advocacy Map / description enrichment" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);
  } catch {
    return null;
  }
}

/**
 * Ask Claude Haiku to pull a clean 2-3 sentence project description from raw
 * page text. Returns null if no relevant content is found.
 */
export async function extractDescriptionWithLLM(
  pageText: string,
  projectName: string,
): Promise<string | null> {
  const { text } = await generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    prompt: `You are extracting project descriptions for a DC transportation advocacy map.

Project name: "${projectName}"

Page text (may contain nav, footers, etc):
${pageText}

Write a clear 2-3 sentence description of this project — what it is, where it is, and what it will accomplish. Use plain language. If no project-relevant content exists in the text, respond with exactly: null`,
    maxOutputTokens: 300,
  });

  const trimmed = text.trim();
  return trimmed === "null" || trimmed.toLowerCase().startsWith("null") ? null : trimmed;
}

export type EnrichResult = {
  id: string;
  updated: boolean;
  description: string | null;
  error?: string;
};

export type EnrichableRecord = {
  id: string;
  name: string;
  source_type: string;
  official_url: string | null;
  description: string | null;
  ward?: string | null;
  mode?: string | null;
  status?: string | null;
  timeline_start?: string | null;
  timeline_end?: string | null;
  cost?: number | null;
  raw?: Record<string, unknown>;
};

/**
 * Synthesize a plain-language description from structured fields using the LLM.
 * Used when no external page is available to scrape.
 */
async function synthesizeDescription(
  record: EnrichableRecord,
  contextLines: string[],
): Promise<string | null> {
  const context = contextLines.filter(Boolean).join("\n");

  const { text } = await generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    prompt: `You are writing plain-language project descriptions for a DC transportation advocacy map.

Project name: "${record.name}"
Known details:
${context}

Write a clear 2-3 sentence description of this project — what it is, where it is in DC, and what it will accomplish or provides. Use plain language for a general audience. Do not invent details not present above. If there is genuinely not enough information to write a meaningful description, respond with exactly: null`,
    maxOutputTokens: 300,
  });

  const trimmed = text.trim();
  return trimmed === "null" || trimmed.toLowerCase().startsWith("null") ? null : trimmed;
}

function asStr(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

export async function enrichRecord(record: EnrichableRecord): Promise<EnrichResult> {
  try {
    if (record.source_type === "bike_lane") {
      if (!record.official_url) {
        return { id: record.id, updated: false, description: record.description };
      }
      const pageText = await fetchPageText(record.official_url);
      if (!pageText) {
        return { id: record.id, updated: false, description: null, error: "fetch_failed" };
      }
      const description = await extractDescriptionWithLLM(pageText, record.name);
      return { id: record.id, updated: description !== null, description };
    }

    if (record.source_type === "capital_project") {
      const raw = record.raw ?? {};
      const contextLines = [
        record.ward ? `Ward: ${record.ward}` : null,
        record.mode ? `Work type: ${record.mode}` : null,
        record.status ? `Status: ${record.status}` : null,
        asStr(raw.ANC) ? `ANC: ${asStr(raw.ANC)}` : null,
        asStr(raw.IntersectionName) ? `Location: ${asStr(raw.IntersectionName)}` : null,
        asStr(raw.RouteName) ? `Route: ${asStr(raw.RouteName)}` : null,
        record.timeline_start ? `Estimated start: ${record.timeline_start}` : null,
        record.timeline_end ? `Estimated completion: ${record.timeline_end}` : null,
        record.cost ? `Estimated cost: $${record.cost.toLocaleString()}` : null,
        asStr(raw.Description) && asStr(raw.Description) !== record.name
          ? `Source note: ${asStr(raw.Description)}`
          : null,
      ].filter((s): s is string => s !== null);

      const description = await synthesizeDescription(record, contextLines);
      return { id: record.id, updated: description !== null, description };
    }

    if (record.source_type === "trail_project") {
      const raw = record.raw ?? {};
      const isPlanned = record.id.startsWith("trail-planned-");
      const contextLines = [
        record.ward ? `Ward(s): ${record.ward}` : null,
        record.status ? `Status: ${record.status}` : null,
        isPlanned
          ? [
              asStr(raw.USE_TYPE) ? `Use type: ${asStr(raw.USE_TYPE)}` : null,
              raw.LENGTH ? `Length: ${Math.round(Number(raw.LENGTH)).toLocaleString()} ft` : null,
              asStr(raw.TRAIL_SEGMENT) ? `Segment: ${asStr(raw.TRAIL_SEGMENT)}` : null,
            ]
          : [
              asStr(raw.TRAIL_CLASS) ? `Trail class: ${asStr(raw.TRAIL_CLASS)}` : null,
              asStr(raw.SURFACE_TYPE) ? `Surface: ${asStr(raw.SURFACE_TYPE)}` : null,
              asStr(raw.MAINTENANCE) ? `Maintained by: ${asStr(raw.MAINTENANCE)}` : null,
              asStr(raw.TRAIL_SEGMENT) ? `Segment: ${asStr(raw.TRAIL_SEGMENT)}` : null,
              raw.YEAR_CONSTRUCTED ? `Year constructed: ${raw.YEAR_CONSTRUCTED}` : null,
            ],
      ]
        .flat()
        .filter((s): s is string => s !== null);

      const description = await synthesizeDescription(record, contextLines);
      return { id: record.id, updated: description !== null, description };
    }

    return { id: record.id, updated: false, description: record.description };
  } catch (err) {
    return {
      id: record.id,
      updated: false,
      description: null,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
