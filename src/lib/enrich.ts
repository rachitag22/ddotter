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
    maxTokens: 300,
  });

  const trimmed = text.trim();
  return trimmed === "null" || trimmed.toLowerCase().startsWith("null") ? null : trimmed;
}

/**
 * Sources + approach for each type:
 *
 * bike_lane   — official_url from DDOT BikeLane FeatureServer → bikelanes.ddot.dc.gov/pages/[slug]
 *               These pages have rich prose descriptions. Scrape + LLM extract. ✓ implemented below.
 *
 * capital_project — raw.Description in PTP is often empty/project-name only.
 *               DDOT's project portal (ddot.dc.gov/page/ddot-capital-projects) has individual
 *               project pages but no machine-readable index. Best approach: search-and-scrape
 *               using `name` as a query against ddot.dc.gov search, then LLM extract.
 *               Alternative: OpenData DC "Capital Projects" has a `DESCRIPTION` field that's
 *               sometimes richer than the GIS layer — worth joining on ProjectID.
 *
 * trail_project — Existing trails are infrastructure records; DDOT/NCRPA trail pages exist but
 *               are inconsistently structured. Best sources: TrailLink.com has DC trail data with
 *               descriptions, or the DC Trail Finder (trailsfordc.org). LLM extraction from
 *               trail-finder pages is the most reliable path.
 *
 * art_installation — Currently using DCGIS Memorials layer (wrong source). The DC Office of
 *               Planning has a public art inventory at opendata.dc.gov (dataset: "Public Art").
 *               That dataset has `DESCRIPTION` fields. Switch the source entirely rather than
 *               scraping — fetch from:
 *               https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Cultural_and_Society_WebMercator/MapServer/18/query
 */

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
  // For now: bike_lane only (has official_url)
  if (record.source_type !== "bike_lane" || !record.official_url) {
    return { id: record.id, updated: false, description: record.description };
  }

  try {
    const pageText = await fetchPageText(record.official_url);
    if (!pageText) {
      return { id: record.id, updated: false, description: null, error: "fetch_failed" };
    }

    const description = await extractDescriptionWithLLM(pageText, record.name);
    return { id: record.id, updated: description !== null, description };
  } catch (err) {
    return {
      id: record.id,
      updated: false,
      description: null,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
