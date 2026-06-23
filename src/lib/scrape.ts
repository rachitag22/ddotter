import type { AssetType, ProjectAsset } from "@/lib/types";
import { fetchHtmlWithBrowser, needsBrowser } from "@/lib/browser";

type RawAsset = { url: string; title: string | null; asset_type: AssetType; file_type: string | null };

function classifyAsset(url: string, title: string | null): { asset_type: AssetType; file_type: string | null } {
  const lower = url.toLowerCase();

  if (/\.(pdf)(\?|#|$)/.test(lower)) return { asset_type: "document", file_type: "pdf" };
  if (/\.(pptx?|odp)(\?|#|$)/.test(lower)) return { asset_type: "document", file_type: "presentation" };
  if (/\.(docx?|odt)(\?|#|$)/.test(lower)) return { asset_type: "document", file_type: "document" };
  // Only specific videos, not channel/playlist pages
  if (/youtube\.com\/watch\?|youtu\.be\/[a-z0-9_-]+|vimeo\.com\/\d+/i.test(lower)) return { asset_type: "video", file_type: null };
  if (/\.(jpe?g|png|gif|webp|svg)(\?|#|$)/.test(lower)) return { asset_type: "photo", file_type: null };
  if (/remix\.com|arcgis\.com\/apps\/(webappviewer|mapviewer|instant|dashboards)/i.test(lower)) {
    return { asset_type: "map", file_type: null };
  }
  if (/app\.box\.com\/s\//i.test(lower)) return { asset_type: "document", file_type: null };

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

// DDOT pages share a large nav/footer. These patterns identify links that are
// site chrome rather than project-specific content and should be discarded.
const SKIP_LINK_PATTERNS = [
  // ddot.dc.gov — keep only /sites/ (document downloads); everything else is nav
  /^https?:\/\/ddot\.dc\.gov\/(?!sites\/)/,
  // DDOT subdomains that are general program pages, not project-specific
  /^https?:\/\/(?:ate|bikelanes|ebikes|freight|stormwater|trails|policy|publicspaceactivation|projects)\.ddot\.dc\.gov\//,
  // dc.gov utility pages
  /^https?:\/\/(?:www\.)?dc\.gov\//,
  /^https?:\/\/dcforms\.dc\.gov\//,
  /^https?:\/\/oca\.dc\.gov\//,
  /^https?:\/\/dataviz\d*\.dc\.gov\//,           // budget dashboards
  // DDOT's own blog/social properties
  /^https?:\/\/ddotdish\.com\//,
  /^https?:\/\/ddotdc\.tumblr\.com\//,
  // Social media (footer icons)
  /^https?:\/\/(?:www\.)?(facebook|twitter|instagram|pinterest|flickr|tumblr|scribd)\.com\//,
  /^https?:\/\/bsky\.app\//,
  // Parking/general city services (footer links)
  /^https?:\/\/(?:www\.)?parkdc\.com\//,
  /^https?:\/\/trees\.dc\.gov\//,
  // Accessibility/text-to-speech widgets
  /readspeaker\.com\//,
];

const SKIP_PHOTO_PATTERNS = [
  /shared_assets/,           // social icons, generic assets
  /social_icons/,
  /DDOT-Logo/i,
  /DDOT-Dot/i,
  /ddot_log/i,
  /MayorBlogo/i,             // Mayor's logo (footer)
  /application-pdf\.png/,    // PDF filetype icon
  /biography_content/,       // staff headshots
  /\/themes\//,              // theme/template assets
  /Instagramlogo/i,          // social media logos
  /\+rawURL\+/,              // broken template URLs
  /raw\.githubusercontent\.com\/Esri\//,  // Esri calcite UI icons
];

// Patterns that are always skipped regardless of asset type
const ALWAYS_SKIP_PATTERNS = [
  /arcgis\.com\/sharing\/rest\/oauth2/,      // ArcGIS sign-in flow
  /\.ddot\.dc\.gov\/search\?collection=/,    // Hub generic search pages
];

function isNavLink(url: string): boolean {
  return SKIP_LINK_PATTERNS.some((re) => re.test(url));
}

function isDecorativePhoto(url: string): boolean {
  return SKIP_PHOTO_PATTERNS.some((re) => re.test(url));
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

    if (ALWAYS_SKIP_PATTERNS.some((re) => re.test(resolved))) continue;
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

    // Skip data URIs, tracking pixels, and decorative site assets
    if (resolved.startsWith("data:")) continue;
    if (isDecorativePhoto(resolved)) continue;

    const altMatch = match[0].match(/\balt=["']([^"']*)["']/i);
    const title = altMatch?.[1]?.trim() || null;

    seen.add(resolved);
    assets.push({ url: resolved, title, asset_type: "photo", file_type: null });
  }

  return assets;
}

async function fetchHtml(url: string): Promise<string | null> {
  // For known JS-rendered domains, skip the static fetch entirely.
  if (needsBrowser(url)) return fetchHtmlWithBrowser(url);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "DDOT Advocacy Map / project asset indexer" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Thin-content guard: if the page returned very few links it's probably
    // a JS shell — retry with a real browser.
    const linkCount = (html.match(/<a\s/gi) ?? []).length;
    if (linkCount < 3) return (await fetchHtmlWithBrowser(url)) ?? html;
    return html;
  } catch {
    return null;
  }
}

export async function scrapeProjectPage(
  project: { id: string; official_url: string },
): Promise<Omit<ProjectAsset, "id" | "scraped_at">[]> {
  const html = await fetchHtml(project.official_url);
  if (!html) return [];

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
