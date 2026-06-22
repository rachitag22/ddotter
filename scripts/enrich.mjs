import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_PROD_URL = "https://ddotter.vercel.app";

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

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

function readArgs(argv) {
  const options = {
    baseUrl: "http://localhost:3000",
    sourceType: "bike_lane",
    limit: "10",
    force: false,
  };

  for (const arg of argv) {
    if (arg === "--local") options.baseUrl = "http://localhost:3000";
    else if (arg === "--prod") options.baseUrl = DEFAULT_PROD_URL;
    else if (arg === "--force") options.force = true;
    else if (arg.startsWith("--url=")) options.baseUrl = arg.slice("--url=".length);
    else if (arg.startsWith("--source=")) options.sourceType = arg.slice("--source=".length);
    else if (arg.startsWith("--source_type=")) options.sourceType = arg.slice("--source_type=".length);
    else if (arg.startsWith("--id=")) options.id = arg.slice("--id=".length);
    else if (arg.startsWith("--limit=")) options.limit = arg.slice("--limit=".length);
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  pnpm enrich
  pnpm enrich -- --force
  pnpm enrich -- --prod --force --limit=25
  pnpm enrich -- --id=bike-lane-11th-street-nw --force
  pnpm enrich -- --source=capital_project --limit=10
  pnpm enrich -- --url=https://preview-url.vercel.app --source=bike_lane

Defaults:
  --local
  --source=bike_lane
  --limit=10

Options:
  --prod              Use https://ddotter.vercel.app
  --local             Use http://localhost:3000
  --url=<url>         Use a custom deployment URL
  --id=<feature-id>   Enrich one specific feature
  --source=<type>     bike_lane, capital_project, or trail_project
  --limit=<n|-1>      Number of records to process
  --force             Retry records with last_enrichment_attempted_at already set
`);
}

function summarize(data, options) {
  console.log(JSON.stringify({
    ok: data.ok,
    records_seen: data.records_seen,
    records_seen_by_type: data.records_seen_by_type,
    records_updated: data.records_updated,
    force: data.force,
  }, null, 2));

  const results = Array.isArray(data.results) ? data.results : [];
  const failures = results.filter((result) => result.error);
  if (failures.length) {
    console.log("\nFailures:");
    for (const failure of failures.slice(0, 10)) {
      console.log(`- ${failure.id}: ${failure.error}`);
    }
    if (failures.length > 10) console.log(`- ...and ${failures.length - 10} more`);
  }

  if (results.length) {
    console.log("\nResults:");
    for (const result of results.slice(0, 10)) {
      const status = result.updated ? "updated" : result.error ? `skipped (${result.error})` : "skipped";
      console.log(`- ${result.id}: ${status}`);
    }
    if (results.length > 10) console.log(`- ...and ${results.length - 10} more`);
  }

  if (data.records_seen === 0 && !options.force) {
    console.log("\nNo records were selected. They may already have last_enrichment_attempted_at set.");
    console.log("Retry with: pnpm enrich -- --force");
  }
}

loadEnvFile(resolve(".env.local"));
loadEnvFile(resolve(".env.vercel.local"));

const options = readArgs(process.argv.slice(2));
const secret = process.env.SYNC_SECRET || process.env.CRON_SECRET;

if (!secret) {
  console.error("Missing SYNC_SECRET or CRON_SECRET in .env.local/.env.vercel.local.");
  process.exit(1);
}

const url = new URL("/api/enrich", options.baseUrl);
url.searchParams.set("source_type", options.sourceType);
url.searchParams.set("limit", options.limit);
if (options.id) url.searchParams.set("id", options.id);
if (options.force) url.searchParams.set("force", "true");

console.log(`Calling ${url.toString()}`);

const response = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secret}`,
  },
});

const text = await response.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  data = { raw: text };
}

if (!response.ok) {
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}

summarize(data, options);
