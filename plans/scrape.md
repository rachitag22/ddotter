# Project Scraping Plan

## Goals

Scrape each project's `official_url` (starting with bike lanes) to gather structured, normalized data beyond the basic description: meetings, documents (with summaries), media, timeline events, design details, and contacts. Store in a dedicated table linked by project ID and display in the UI.

## Decisions

| Question | Answer |
|----------|--------|
| Browserbase | Yes — fallback when plain fetch returns thin content (<300 chars body) |
| PDF handling | URL + title + LLM summary (Haiku, first 3 PDFs per project, opt-in via `?summarize_pdfs=true`) |
| Storage | New `project_details` table (1:1 with projects via FK, separate RLS) |
| When to run | On-demand via `/api/scrape`; easy test via `scripts/scrape.mjs` |
| feature → project | Yes — full rename in DB, types, routes, and components |

---

## Phase 1: DB Migrations

### `20260621002000_rename_features_to_projects.sql`
- `ALTER TABLE features RENAME TO projects`
- `ALTER TABLE feedback RENAME COLUMN feature_id TO project_id`
- Drop `features_with_feedback` view
- Create `projects_with_feedback` view (same logic, references `projects` + `feedback.project_id`)
- Grant INSERT/UPDATE on `projects` to anon (replace old grants on `features`)

### `20260621002001_project_details.sql`
```sql
CREATE TABLE public.project_details (
  project_id      text PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  meetings        jsonb NOT NULL DEFAULT '[]',
  documents       jsonb NOT NULL DEFAULT '[]',
  media           jsonb NOT NULL DEFAULT '[]',
  timeline_events jsonb NOT NULL DEFAULT '[]',
  design_details  jsonb,
  contacts        jsonb NOT NULL DEFAULT '[]',
  scraped_at      timestamptz,
  scrape_error    text,
  source_url      text
);
```
- RLS: public SELECT, sync-secret INSERT/UPDATE (mirrors projects table policies)
- Index on `scraped_at IS NULL` for the "needs scraping" queue

---

## Phase 2: TypeScript Refactor (feature → project)

### `src/lib/types.ts`
- Rename `FeatureRecord` → `ProjectRecord`
- Rename `FeatureFilters` → `ProjectFilters`
- Rename `ListFeatureRecord` → `ListProjectRecord`
- Add `scraped_details?: ScrapedDetails | null` to `ProjectRecord`
- Add `ScrapedDetails` and sub-types (see below)

### ScrapedDetails shape
```typescript
type ScrapedMeeting = {
  date: string | null;
  title: string;
  url: string | null;
  type: "public_comment" | "open_house" | "webinar" | "anc_hearing" | "council_hearing" | "other";
};

type ScrapedDocument = {
  title: string;
  url: string;
  file_type: "pdf" | "presentation" | "report" | "plan" | "other";
  summary: string | null;  // LLM summary of document purpose (opt-in)
};

type ScrapedMedia = {
  url: string;
  type: "image" | "video" | "remix_map";
  caption: string | null;
};

type ScrapedDetails = {
  meetings: ScrapedMeeting[];
  documents: ScrapedDocument[];
  media: ScrapedMedia[];
  timeline_events: { date: string | null; label: string }[];
  design_details: { phases: string[]; lane_configs: string[]; notes: string | null };
  contacts: { name: string | null; email: string | null; phone: string | null }[];
};
```

### Files to rename/update
| Old | New | Change |
|-----|-----|--------|
| `src/lib/features.ts` | `src/lib/projects.ts` | rename + update table/view refs to `projects`/`projects_with_feedback` |
| `src/lib/feedback.ts` | same | `feature_id` → `project_id` in DB query |
| `src/lib/enrich.ts` | same | `EnrichableRecord` updates, table ref `projects` |
| `src/lib/arcgis.ts` | same | import `ProjectRecord` |
| `src/lib/sample-data.ts` | same | import `ProjectRecord` |
| `src/app/api/features/route.ts` | `src/app/api/projects/route.ts` | rename + update imports |
| `src/app/api/features/[id]/route.ts` | `src/app/api/projects/[id]/route.ts` | rename |
| `src/app/api/features/[id]/feedback/route.ts` | `src/app/api/projects/[id]/feedback/route.ts` | rename |
| `src/app/features/[id]/page.tsx` | `src/app/projects/[id]/page.tsx` | rename |
| `src/components/FeatureModal.tsx` | same file | types + permalink `/projects/[id]` |
| `src/components/BottomDrawer.tsx` | same | types + permalink |
| `src/components/FeedbackForm.tsx` | same | API URL `/api/projects/${id}/feedback` |
| `src/components/MapView.tsx` | same | import `ProjectRecord` |
| `src/components/MapWrapper.tsx` | same | import `ProjectRecord` |
| `src/components/SegmentList.tsx` | same | import `ProjectRecord` |
| `src/app/page.tsx` | same | imports from `projects` |
| `src/app/api/features.geojson/route.ts` | same | imports only |
| `src/app/api/enrich/route.ts` | same | table ref `projects` |
| `src/app/api/sync/route.ts` | same | imports |

---

## Phase 3: `src/lib/scrape.ts` (new)

### HTML signal extraction (regex, no DOM library)
- All `<a href>` links with anchor text → categorize (PDF, Remix, YouTube/Vimeo, other)
- All `<img src alt>` → filter out icons/logos by URL pattern
- Body text strip (same approach as current `fetchPageText`)
- Email pattern: `[\w.+-]+@[\w-]+\.[a-z]{2,}`
- Phone pattern: `\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}`

### LLM normalization
- **Single `generateObject` call (Haiku)** per page using Zod schema
- Input: links summary (top 50), images list (top 20), 4000-char body text
- Output: full `ScrapedDetails` object
- Empty arrays returned if nothing relevant found

### PDF summarization (opt-in)
- Triggered by `?summarize_pdfs=true` on `/api/scrape`
- Limit 3 PDFs per project
- Fetch PDF → base64 → Claude Haiku document message → 1-2 sentence summary
- Updates `documents[].summary` in stored result

### Browserbase fallback
- After plain fetch, check if `bodyText.length < 300`
- If thin and `BROWSERBASE_API_KEY` env var is set: use Browserbase to render full page
- Else store `scrape_error: "thin_content"` and move on

---

## Phase 4: `src/app/api/scrape/route.ts` (new)

```
GET /api/scrape
  ?source_type=bike_lane   (default: bike_lane only)
  ?id=<project-id>         (single project)
  ?force=true              (re-scrape already-scraped)
  ?limit=N                 (default: 5, env SCRAPE_LIMIT, -1 = unlimited)
  ?summarize_pdfs=true     (enable PDF summarization pass)
```

- Auth: same `SYNC_SECRET` bearer check
- Reads from `projects` where `source_type = 'bike_lane'` AND `official_url IS NOT NULL` AND `scraped_at IS NULL` (unless `force`)
- Calls `scrapeProjectPage()` per project (concurrency: 3, slower than enrich to be polite)
- Upserts result to `project_details` table
- Returns JSON: `{ projects_seen, projects_updated, errors }`

### Helper script: `scripts/scrape.mjs`
- Mirrors existing `scripts/enrich.mjs` pattern
- `node scripts/scrape.mjs --local` hits `http://localhost:3000`
- `node scripts/scrape.mjs --prod` hits `https://ddotter.vercel.app`
- Flags: `--limit=1`, `--id=bike-lane-<slug>`, `--force`, `--summarize-pdfs`

---

## Phase 5: `src/components/ProjectDetails.tsx` (new)

Display scraped details in both `BottomDrawer` (detail view) and project permalink page.
Only render sections where data is non-empty.

- **Meetings** — sorted by date asc; upcoming ones get "Upcoming" label; each is a chip/link
- **Documents** — PDF icon + title as download link; collapsed summary paragraph if present
- **Media** — image thumbnails (open in new tab), YouTube/Vimeo links, Remix map links
- **Timeline** — vertical list of labeled events with dates
- **Design details** — tags for lane configs and phases; notes as paragraph
- **Contact** — email as mailto link, phone as tel link

### Data fetching
- For the list view: `scraped_details` is NOT loaded (avoid bloating list query)
- For detail view: `getProject(id)` also fetches `project_details` via a separate Supabase call
- `ProjectRecord` gets optional `scraped_details?: ScrapedDetails | null`

---

## Sequencing

- [ ] DB migration 1: rename features → projects
- [ ] DB migration 2: create project_details table
- [ ] TypeScript: rename types (FeatureRecord → ProjectRecord etc.) in types.ts
- [ ] TypeScript: rename features.ts → projects.ts, update all imports across codebase
- [ ] TypeScript: enrich.ts table ref update
- [ ] TypeScript: feedback.ts column rename
- [ ] New: src/lib/scrape.ts
- [ ] New: src/app/api/scrape/route.ts
- [ ] New: scripts/scrape.mjs
- [ ] New: src/components/ProjectDetails.tsx
- [ ] Wire ProjectDetails into BottomDrawer + project permalink page
- [ ] Wire scraped_details into getProject() (separate fetch, not in list)
- [ ] pnpm build to verify

---

## Environment variables (new)

| Variable | Notes |
|----------|-------|
| `BROWSERBASE_API_KEY` | Optional; enables JS-rendered page fallback |
| `SCRAPE_LIMIT` | Max projects scraped per run; default 5, -1 = unlimited |

---

## Open items / future

- Expand scraping to `capital_project` (need URL source — DDOT PTP, DC Budget pages)
- Full Browserbase integration for JS-rendered pages
- Scheduled weekly re-scrape for meeting updates (`0 6 * * 1`)
- Auto-scrape hook after sync for newly added projects
