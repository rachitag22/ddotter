# Refactor: features → projects

Rename the TypeScript types, functions, filenames, and URL routes from "feature/features" to "project/projects". The Supabase table (`features`), view (`features_with_feedback`), and column (`feature_id`) are **NOT changed** — those are a separate DB migration and are kept as-is here.

## Scope

### File renames
| Old | New |
|-----|-----|
| `src/lib/features.ts` | `src/lib/projects.ts` |
| `src/components/FeatureModal.tsx` | `src/components/ProjectModal.tsx` |
| `src/app/features/[id]/page.tsx` | `src/app/projects/[id]/page.tsx` |
| `src/app/api/features/route.ts` | `src/app/api/projects/route.ts` |
| `src/app/api/features/[id]/route.ts` | `src/app/api/projects/[id]/route.ts` |
| `src/app/api/features/[id]/feedback/route.ts` | `src/app/api/projects/[id]/feedback/route.ts` |
| `src/app/api/features.geojson/route.ts` | `src/app/api/projects.geojson/route.ts` |

### Type renames (in `src/lib/types.ts`)
- `FeatureRecord` → `ProjectRecord`
- `FeatureFilters` → `ProjectFilters`
- `ListFeatureRecord` → `ListProjectRecord`

### Function renames (in `src/lib/projects.ts`)
- `getFeatures` → `getProjects`
- `getFeature` → `getProject`
- `sampleFeatures` → `sampleProjects` (in `sample-data.ts`)

### URL path changes
- `/features/[id]` → `/projects/[id]`
- `/api/features` → `/api/projects`
- `/api/features/[id]` → `/api/projects/[id]`
- `/api/features/[id]/feedback` → `/api/projects/[id]/feedback`
- `/api/features.geojson` → `/api/projects.geojson`

### NOT changed
- DB table: `features` (requires separate migration)
- DB view: `features_with_feedback`
- DB column: `feature_id`
- All SQL migration files
- Internal variable names like `feature` in map callbacks (kept for readability where they refer to ArcGIS feature layer concepts)

## Execution order (dependency-safe)

1. `src/lib/types.ts` — rename exported types (this breaks everything; fix in order)
2. `src/lib/sample-data.ts` — `sampleFeatures` → `sampleProjects`
3. `src/lib/arcgis.ts` — import `ProjectRecord`, update return types
4. `src/lib/enrich.ts` — import `ProjectRecord` if referenced
5. `src/lib/url.ts` — import `ProjectFilters`
6. `src/lib/projects.ts` — new file (copy + update features.ts); delete features.ts
7. `src/components/SegmentList.tsx` — import `ProjectRecord`
8. `src/components/MapView.tsx` — import `ProjectRecord`
9. `src/components/MapWrapper.tsx` — import `ProjectRecord`, `ProjectFilters`
10. `src/components/ProjectModal.tsx` — rename from FeatureModal.tsx; update all internals
11. `src/components/BottomDrawer.tsx` — update imports, `FeatureModal` → `ProjectModal`, type refs, URLs
12. `src/components/FeedbackForm.tsx` — update API URL `/api/features/` → `/api/projects/`
13. New API routes under `src/app/api/projects/`
14. `src/app/projects/[id]/page.tsx` — new page (rename from features/[id])
15. `src/app/page.tsx` — update imports and variable names
16. `pnpm build` — verify zero TypeScript errors

## Testing plan (prevent build failures)

### Pre-execution checks
- `pnpm build` on current main to confirm baseline is green before touching anything

### During execution
- Work strictly in the order above: types first, then libs, then components, then routes/pages
- Never leave a partially-renamed import (rename importer and importee in the same step)
- After step 6 (projects.ts created, features.ts deleted): run `pnpm build` as checkpoint
- After step 12 (all components done): run `pnpm build` as checkpoint
- After step 15 (all pages/routes done): final `pnpm build`

### What to verify after build passes
- [ ] `pnpm build` exits 0 with no TypeScript errors
- [ ] `ProjectRecord`, `ProjectFilters`, `ListProjectRecord` exported from `types.ts`
- [ ] No remaining imports from `@/lib/features`
- [ ] No remaining references to `FeatureRecord`, `FeatureFilters`, `ListFeatureRecord`
- [ ] No remaining route files under `src/app/api/features/` or `src/app/features/`
- [ ] `/projects/[id]` page exists; `/features/[id]` page deleted
- [ ] `FeedbackForm` posts to `/api/projects/[id]/feedback`
- [ ] Permalink in `FeatureModal` → `ProjectModal` points to `/projects/[id]`
