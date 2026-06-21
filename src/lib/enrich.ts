import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

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

const LABEL_BATCH_SIZE = 50;

async function cleanLabelBatch(labels: string[]): Promise<Map<string, string>> {
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

export async function cleanSegmentLabels(labels: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(labels.filter(Boolean))];
  if (!unique.length || !process.env.ANTHROPIC_API_KEY) return new Map();

  const result = new Map<string, string>();
  for (let i = 0; i < unique.length; i += LABEL_BATCH_SIZE) {
    try {
      const cleaned = await cleanLabelBatch(unique.slice(i, i + LABEL_BATCH_SIZE));
      for (const [orig, clean] of cleaned) result.set(orig, clean);
    } catch {
      // partial success is fine; originals used for failed batches
    }
  }
  return result;
}

// Search DDOT's website for a capital project by name, return the first result URL.
async function findDdotProjectUrl(projectName: string): Promise<string | null> {
  const query = encodeURIComponent(projectName);
  const searchUrl = `https://ddot.dc.gov/search?search_api_fulltext=${query}&type=project_page`;
  const pageText = await fetchPageText(searchUrl);
  if (!pageText) return null;

  const match = pageText.match(/\/page\/[a-z0-9-]{4,}|\/node\/\d+/);
  if (!match) return null;

  return `https://ddot.dc.gov${match[0]}`;
}

export type EnrichResult = {
  id: string;
  updated: boolean;
  description: string | null;
  error?: string;
};

export async function enrichRecord(record: {
  id: string;
  name: string;
  source_type: string;
  official_url: string | null;
  description: string | null;
}): Promise<EnrichResult> {
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
      if (record.description && record.description.length > 60 && record.description !== record.name) {
        return { id: record.id, updated: false, description: record.description };
      }

      const url = record.official_url ?? (await findDdotProjectUrl(record.name));
      if (!url) {
        return { id: record.id, updated: false, description: null, error: "no_url_found" };
      }

      const pageText = await fetchPageText(url);
      if (!pageText) {
        return { id: record.id, updated: false, description: null, error: "fetch_failed" };
      }
      const description = await extractDescriptionWithLLM(pageText, record.name);
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

