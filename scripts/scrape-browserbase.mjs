/**
 * Standalone Browserbase scraper for JS-rendered DDOT project pages.
 *
 * Runs outside the Next.js API (no bundle-size constraints) and directly
 * upserts to Supabase.  Use it for projects where plain fetch returns thin
 * content (< 300 chars of visible text), which the /api/scrape route skips.
 *
 * Requires:
 *   BROWSERBASE_API_KEY  — Browserbase API key
 *   BROWSERBASE_PROJECT_ID — Browserbase project ID
 *   SUPABASE_URL + SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY)
 *   SYNC_SECRET (for /api/scrape calls — not needed here, we hit Supabase directly)
 *
 * Usage:
 *   pnpm scrape:bb               # scrape 3 thin-content bike lanes
 *   pnpm scrape:bb -- --limit=10
 *   pnpm scrape:bb -- --force    # re-scrape even if assets exist
 *   pnpm scrape:bb -- --source=capital_project
 *   pnpm scrape:bb -- --id=<project-id>
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function readArgs(argv) {
  const options = { sourceType: "bike_lane", limit: 3, force: false, id: null };
  for (const arg of argv) {
    if (arg === "--force") options.force = true;
    else if (arg.startsWith("--source=")) options.sourceType = arg.slice("--source=".length);
    else if (arg.startsWith("--source_type=")) options.sourceType = arg.slice("--source_type=".length);
    else if (arg.startsWith("--id=")) options.id = arg.slice("--id=".length);
    else if (arg.startsWith("--limit=")) {
      const v = parseInt(arg.slice("--limit=".length), 10);
      options.limit = v === -1 ? Infinity : v;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: pnpm scrape:bb [-- options]
  --source=<type>    bike_lane | capital_project | trail_project (default: bike_lane)
  --id=<project-id>  scrape one project
  --limit=<n|-1>     max projects (default: 3, -1 = all)
  --force            re-scrape even if assets already exist
`);
      process.exit(0);
    }
  }
  return options;
}

// ─── Asset extraction (mirrors src/lib/scrape.ts) ────────────────────────────

const SKIP_LINK_PATTERNS = [
  /^https?:\/\/ddot\.dc\.gov\/(?!sites\/)/,
  /^https?:\/\/(?:ate|bikelanes|ebikes|freight|stormwater|trails|policy|publicspaceactivation|projects)\.ddot\.dc\.gov\//,
  /^https?:\/\/(?:www\.)?dc\.gov\//,
  /^https?:\/\/dcforms\.dc\.gov\//,
  /^https?:\/\/oca\.dc\.gov\//,
  /^https?:\/\/dataviz\d*\.dc\.gov\//,
  /^https?:\/\/ddotdish\.com\//,
  /^https?:\/\/ddotdc\.tumblr\.com\//,
  /^https?:\/\/(?:www\.)?(facebook|twitter|instagram|pinterest|flickr|tumblr|scribd)\.com\//,
  /^https?:\/\/bsky\.app\//,
  /^https?:\/\/(?:www\.)?parkdc\.com\//,
  /^https?:\/\/trees\.dc\.gov\//,
  /readspeaker\.com\//,
];

const SKIP_PHOTO_PATTERNS = [
  /shared_assets/, /social_icons/, /DDOT-Logo/i, /DDOT-Dot/i, /ddot_log/i,
  /MayorBlogo/i, /application-pdf\.png/, /biography_content/, /\/themes\//,
  /Instagramlogo/i, /\+rawURL\+/,
];

function classifyAsset(url, title) {
  const lower = url.toLowerCase();
  if (/\.(pdf)(\?|#|$)/.test(lower)) return { asset_type: "document", file_type: "pdf" };
  if (/\.(pptx?|odp)(\?|#|$)/.test(lower)) return { asset_type: "document", file_type: "presentation" };
  if (/\.(docx?|odt)(\?|#|$)/.test(lower)) return { asset_type: "document", file_type: "document" };
  if (/youtube\.com\/watch\?|youtu\.be\/[a-z0-9_-]+|vimeo\.com\/\d+/i.test(lower)) return { asset_type: "video", file_type: null };
  if (/\.(jpe?g|png|gif|webp|svg)(\?|#|$)/.test(lower)) return { asset_type: "photo", file_type: null };
  if (/remix\.com|arcgis\.com\/apps\/(webappviewer|mapviewer|instant|dashboards)/i.test(lower)) return { asset_type: "map", file_type: null };
  if (title) {
    const t = title.toLowerCase();
    if (t.includes("map") || t.includes("viewer")) return { asset_type: "map", file_type: null };
    if (t.includes("video") || t.includes("webinar") || t.includes("recording")) return { asset_type: "video", file_type: null };
    if (t.includes("pdf") || t.includes("report") || t.includes("document") || t.includes("presentation")) return { asset_type: "document", file_type: null };
    if (t.includes("photo") || t.includes("image") || t.includes("gallery")) return { asset_type: "photo", file_type: null };
  }
  return { asset_type: "link", file_type: null };
}

function resolveUrl(href, base) {
  try { return new URL(href, base).toString(); } catch { return null; }
}

function extractAssets(html, baseUrl) {
  const seen = new Set();
  const assets = [];

  for (const match of html.matchAll(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1].trim();
    const anchorHtml = match[2];
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
    const resolved = resolveUrl(href, baseUrl);
    if (!resolved || seen.has(resolved)) continue;
    const title = anchorHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null;
    const { asset_type, file_type } = classifyAsset(resolved, title);
    if (asset_type === "link" && SKIP_LINK_PATTERNS.some((re) => re.test(resolved))) continue;
    seen.add(resolved);
    assets.push({ url: resolved, title, asset_type, file_type });
  }

  for (const match of html.matchAll(/<img\s[^>]*src=["']([^"']+)["'][^>]*/gi)) {
    const src = match[1].trim();
    const resolved = resolveUrl(src, baseUrl);
    if (!resolved || seen.has(resolved)) continue;
    if (resolved.startsWith("data:")) continue;
    if (SKIP_PHOTO_PATTERNS.some((re) => re.test(resolved))) continue;
    const altMatch = match[0].match(/\balt=["']([^"']*)["']/i);
    const title = altMatch?.[1]?.trim() || null;
    seen.add(resolved);
    assets.push({ url: resolved, title, asset_type: "photo", file_type: null });
  }

  return assets;
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!key) throw new Error("Missing SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY");
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function supabaseFetch(path, opts = {}) {
  const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("Missing SUPABASE_URL");
  const res = await fetch(`${base}/rest/v1/${path}`, {
    headers: supabaseHeaders(),
    ...opts,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body;
}

// ─── Browserbase scraper ──────────────────────────────────────────────────────

async function scrapeWithBrowserbase(officialUrl) {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!apiKey || !projectId) throw new Error("Missing BROWSERBASE_API_KEY or BROWSERBASE_PROJECT_ID");

  const { default: Browserbase } = await import("@browserbasehq/sdk");
  const { chromium } = await import("playwright-core");

  const bb = new Browserbase({ apiKey });
  const session = await bb.sessions.create({ projectId });

  const browser = await chromium.connectOverCDP(session.connectUrl);
  try {
    const ctx = browser.contexts()[0] ?? await browser.newContext();
    const page = ctx.pages()[0] ?? await ctx.newPage();
    await page.goto(officialUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    // Wait a beat for JS-rendered content to settle
    await page.waitForTimeout(2_000);
    return await page.content();
  } finally {
    await browser.close();
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

loadEnvFile(resolve(".env.local"));
loadEnvFile(resolve(".env.vercel.local"));

const options = readArgs(process.argv.slice(2));

const SCRAPEABLE_TYPES = ["bike_lane", "capital_project", "trail_project"];
const targetType = SCRAPEABLE_TYPES.includes(options.sourceType) ? options.sourceType : "bike_lane";

// Fetch projects that have official_url
let qs = `projects?select=id,name,official_url&source_type=eq.${targetType}&official_url=not.is.null&order=synced_at.desc`;
if (options.id) qs += `&id=eq.${options.id}`;

let projects = await supabaseFetch(qs);

// Unless forced, skip projects that already have assets
if (!options.force && projects.length > 0) {
  const ids = projects.map((p) => `"${p.id}"`).join(",");
  const existing = await supabaseFetch(`project_assets?select=project_id&project_id=in.(${ids})`);
  const scrapedIds = new Set(existing.map((r) => r.project_id));
  projects = projects.filter((p) => !scrapedIds.has(p.id));
}

if (options.limit !== Infinity) {
  projects = projects.slice(0, options.limit);
}

console.log(`Scraping ${projects.length} projects via Browserbase (source_type=${targetType}, force=${options.force})`);

let updated = 0;
let totalAssets = 0;
const errors = [];

for (const project of projects) {
  process.stdout.write(`  ${project.name} … `);
  try {
    const html = await scrapeWithBrowserbase(project.official_url);

    // Check visible text length
    const visibleText = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (visibleText.length < 300) {
      console.log("⚠  thin content (<300 chars visible text), skipping");
      continue;
    }

    const raw = extractAssets(html, project.official_url);
    const assets = raw.map(({ url, title, asset_type, file_type }) => ({
      project_id: project.id,
      asset_type,
      url,
      title,
      file_type,
      scraped_at: new Date().toISOString(),
    }));

    // Delete stale then insert fresh
    await supabaseFetch(
      `project_assets?project_id=eq.${project.id}`,
      { method: "DELETE" },
    );

    if (assets.length > 0) {
      await supabaseFetch("project_assets", {
        method: "POST",
        body: JSON.stringify(assets),
        headers: { ...supabaseHeaders(), Prefer: "return=minimal" },
      });
    }

    console.log(`✓ ${assets.length} assets`);
    updated++;
    totalAssets += assets.length;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`✗ ${msg.slice(0, 120)}`);
    errors.push({ id: project.id, error: msg });
  }
}

console.log(`\nDone — ${updated}/${projects.length} updated, ${totalAssets} total assets`);
if (errors.length) {
  console.log("Errors:");
  for (const e of errors) console.log(`  ${e.id}: ${e.error}`);
}
