import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env.local") });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const migrations = [
  "supabase/migrations/20260621002000_rename_features_to_projects.sql",
  "supabase/migrations/20260622001001_project_assets.sql",
];

for (const file of migrations) {
  const sql = readFileSync(path.join(__dirname, "..", file), "utf8");
  console.log(`Running ${file}...`);

  const res = await fetch(`${url}/rest/v1/rpc/pg_execute`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const body = await res.text();
    // Try the SQL endpoint instead
    const res2 = await fetch(`${url.replace(".supabase.co", ".supabase.co")}/pg`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });
    if (!res2.ok) {
      console.error(`Failed: ${body}`);
      process.exit(1);
    }
  }
  console.log(`  OK`);
}
