import type { AssetType, ProjectAsset } from "@/lib/types";

type RawAsset = { url: string; title: string | null; asset_type: AssetType; file_type: string | null };

function classifyAsset(url: string, title: string | null): { asset_type: AssetType; file_type: string | null } {
  const lower = url.toLowerCase();

  if (/\.(pdf)(\?|#|$)/.test(lower)) return { asset_type: "document", file_type: "pdf" };
  if (/\.(pptx?|odp)(\?|#|$)/.test(lower)) return { asset_type: "document", file_type: "presentation" };
  if (/\.(docx?|odt)(\?|#|$)/.test(lower)) return { asset_type: "document", file_type: "document" };
  if (/youtube\.com|youtu\.be|vimeo\.com/.test(lower)) return { asset_type: "video", file_type: null };
  if (/\.(jpe?g|png|gif|webp|svg)(\?|#|$)/.test(lower)) return { asset_type: "photo", file_type: null };
  if (/remix\.com|arcgis\.com\/apps\/(webappviewer|mapviewer|instant|dashboards)/i.test(lower)) {
    return { asset_type: "map", file_type: null };
  }

  // Title-based hints when URL is ambiguous
  if (title) {
    const t = title.toLowerCase();
    if (t.includes("map") || t.includes("viewer")) return { asset_type: "map", file_type: null };
    if (t.includes("video") || t.includes("webinar") || t.includes("recording")) {
      return { asset_type: "video", file_type: null };
    }
    if (t.includes("pdf") || t.includes("report") || t.includes("document") || t.includes("presentation")) {
      return { asset_type: "document", file_type: null };
    }
    if (t.includes("photo") || t.includes("image") || t.includes("gallery")) {
      return { asset_type: "photo", file_type: null };
    }
  }

  return { asset_type: "link", file_type: null };
}

function resolveUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

// DDOT pages have a large shared nav/footer. These patterns reliably identify
// nav/utility links that are not project-specific and should be discarded.
const NAV_PATTERNS = [
  /^https?:\/\/(?:www\.)?dc\.gov\//,                   // dc.gov utility pages
  /^https?:\/\/ddot\.dc\.gov\/page\//,                 // DDOT program pages (nav)
  /^https?:\/\/ddot\.dc\.gov\/social/,                 // social media hub
  /^https?:\/\/ddot\.dc\.gov\/publication\//,          // org charts, etc.
  /^https?:\/\/ddot\.dc\.gov\/cdn-cgi\//,              // Cloudflare email obfuscation
  /^https?:\/\/dcforms\.dc\.gov\//,                    // generic DC forms
  /^https?:\/\/oca\.dc\.gov\//,                        // Office of Contracting
];

function isNavLink(url: string): boolean {
  return NAV_PATTERNS.some((re) => re.test(url));
}

export function extractAssets(html: string, baseUrl: string): RawAsset[] {
  const seen = new Set<string>();
  const assets: RawAsset[] = [];

  // Extract <a href> links
  for (const match of html.matchAll(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1].trim();
    const anchorHtml = match[2];

    // Skip non-navigable hrefs
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
      continue;
    }

    const resolved = resolveUrl(href, baseUrl);
    if (!resolved || seen.has(resolved)) continue;

    // Strip HTML tags from anchor text
    const title = anchorHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null;
    const { asset_type, file_type } = classifyAsset(resolved, title);

    // Drop generic nav/footer links unless they're a typed asset (doc/video/map)
    if (asset_type === "link" && isNavLink(resolved)) continue;

    seen.add(resolved);
    assets.push({ url: resolved, title, asset_type, file_type });
  }

  // Extract <img src> for photos
  for (const match of html.matchAll(/<img\s[^>]*src=["']([^"']+)["'][^>]*/gi)) {
    const src = match[1].trim();
    const resolved = resolveUrl(src, baseUrl);
    if (!resolved || seen.has(resolved)) continue;

    // Skip data URIs and tiny tracking pixels
    if (resolved.startsWith("data:")) continue;

    const altMatch = match[0].match(/\balt=["']([^"']*)["']/i);
    const title = altMatch?.[1]?.trim() || null;

    seen.add(resolved);
    assets.push({ url: resolved, title, asset_type: "photo", file_type: null });
  }

  return assets;
}

export async function scrapeProjectPage(
  project: { id: string; official_url: string },
): Promise<Omit<ProjectAsset, "id" | "scraped_at">[]> {
  let html: string;
  try {
    const res = await fetch(project.official_url, {
      headers: { "User-Agent": "DDOT Advocacy Map / project asset indexer" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  // Thin-content guard (JS-rendered pages); Browserbase fallback is future work
  const bodyText = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (bodyText.length < 300) return [];

  const raw = extractAssets(html, project.official_url);

  return raw.map(({ url, title, asset_type, file_type }) => ({
    project_id: project.id,
    asset_type,
    url,
    title,
    file_type,
  }));
}
