# Dirty Plush Writer's Panel — internal architecture contract

This document is the binding contract between the app shell / data layer and
the five tab components. Read it before touching any component.

## Stack

React 18 + Vite 6 + Tailwind CSS v4 (CSS-first config in `src/styles.css`).
Plain JSX — **no TypeScript syntax anywhere**. No new npm dependencies without
updating `package.json` (installed deps: `leaflet`, `vis-timeline` +
`vis-data`, `react-force-graph-2d`, `js-yaml`, `papaparse`, `marked`,
`dompurify`, `jszip`, `idb-keyval`).

## File map

```
src/
  main.jsx, App.jsx            # shell + tab switch (DONE — do not restructure)
  styles.css                   # theme tokens + shared classes (see below)
  lib/files.js                 # vault backends (FSA + localStorage fallback)
  lib/markdown.js              # frontmatter parse/serialize, relationships, renderMarkdown
  lib/csvArcs.js               # arcs.csv parse/serialize
  lib/seed.js                  # bundles /vault-sample/** as seed content
  state/VaultContext.jsx       # useVault() — THE data API (DONE)
  state/UIContext.jsx          # useUI() — cross-tab navigation (DONE)
  components/
    VaultBar.jsx               # DONE
    map/MapTab.jsx             # tab ① (default export, no props)
    timeline/TimelineTab.jsx   # tab ②
    characters/CharactersTab.jsx  # tab ③
    profile/ProfileTab.jsx     # tab ④
    resources/ResourcesTab.jsx # tab ⑤
vault-sample/                  # the seed vault (real files, committed to git)
```

Each tab is a default-exported component taking **no props**; it fills its
parent (`h-full`) and gets everything from the two hooks. Tabs unmount when
inactive — re-derive view state from vault data on mount, or lift truly
persistent UI state up only if essential (prefer not to).

## Data API — `useVault()` from `src/state/VaultContext.jsx`

```js
const {
  status,        // { mode: 'loading'|'fsa'|'fallback', vaultName, fsaSupported, needsReconnect }
  errors, dismissErrors,
  connectVault, reconnectVault, disconnectVault, reloadVault, exportVault, importVault,

  config, saveConfig,          // writers-panel-config.json (object)
  characters,                  // [{ filename, frontmatter, body }]
  saveCharacter,               // (filename, { frontmatter, body }) => Promise
  createCharacter,             // (name) => Promise<filename>
  deleteCharacter,             // (filename) => Promise
  events, saveEvents,          // timeline/events.json — save takes the FULL next array
  beats, saveBeats,            // structure/beats.json
  arcs, saveArcs,              // arcs.csv rows [{ character, arc_begin, arc_end }]
  locations, saveLocations,    // map/locations.geojson (FeatureCollection)
  resources, saveResources,    // resources/resources.json
} = useVault()
```

All `saveX` functions persist to the vault file AND update React state —
call them with the complete next value (immutably derived). Never write
files directly from a tab.

### Shapes

**character.frontmatter** (Obsidian YAML properties):
```yaml
name: Det. Raymond "Ray" Vega
role: Protagonist; first-person narrator …
relationships:                 # strings "Target Name :: label", optional "(hidden)"
  - Jack Brennan :: partner
  - Dana Vega :: marriage, collapsing
theme_stance: Bears truth's cost
arc_begin: Certain, in control, holds everything
arc_end: Lets go of both secrets; humbled; free in a broken world
```
Parse relationships with `parseRelationships(frontmatter.relationships)` from
`src/lib/markdown.js` → `[{ target, label, hidden }]`. `hidden: true` edges
(in-story secrets, e.g. Brennan↔Dana) render dashed/di mmed.
Character identity = `filename`; display name = `frontmatter.name`.
Match relationship `target` against `frontmatter.name` case-insensitively.

**event** (timeline/events.json entries):
```js
{ id: 'beat-1',            // unique string
  title: 'Barranco Escondido',
  start: '1994-03-04',     // ISO date; required
  end: '1994-03-11',       // optional → range item
  group: 'case-1994',      // 'case-1994' | 'frame-2024'
  color: '#b5533c',        // item accent
  weight: 3,               // 1–5 (render as border thickness / size)
  priority: 'high',        // 'high' | 'medium' | 'low'
  beat: 'hook',            // structure beat id, or '' if unassigned
  summary: 'one-liner shown on hover',
  detail: 'full markdown, shown in the full-screen event view' }
```

**beat** (structure/beats.json entries):
```js
{ id: 'hook', order: 1, label: 'Hook',
  chapter: 1, chapterTitle: 'Barranco Escondido',
  summary: 'one-liner',
  craft: 'long craft explanation (markdown ok) shown on hover-expand' }
```

**arc row**: `{ character, arc_begin, arc_end }` — `character` matches
`frontmatter.name` exactly. `saveArcs` also syncs frontmatter — do not do
that manually.

**locations** GeoJSON feature:
```js
{ type: 'Feature',
  geometry: { type: 'Point', coordinates: [lng, lat] },
  properties: {
    id: 'body-site', name: 'The Dying Avocado Grove (body site)',
    category: 'case',          // 'case' | 'city' | 'police' | 'commercial' | 'nature' | 'institution'
    role: 'pin',               // 'pin' | 'region' — regions feed the zoom-aware info panel
    radiusKm: 30,              // regions only: how far the region info applies
    minZoom: 0, maxZoom: 11,   // regions only: zoom band where the info shows
    summary: 'one-liner',
    detail: 'markdown — author notes on the place',
    fields: [                  // editable metadata list; ESTIMATES ARE FLAGGED
      { label: 'Gas price (1994)', value: '$1.11/gal', estimate: true },
      { label: 'Dominant flora', value: 'chamise, manzanita…', estimate: true },
    ] } }
```
`estimate: true` fields MUST render with the `.estimate-badge` class showing
“estimate — verify”. Never present researched values as fact.

**resource**: `{ title, url, note, category }` with category one of
`'novel' | 'case-file' | 'writing'`.

**config** (writers-panel-config.json):
```js
{ novel: { onedrive_url: '', web_url: '' },   // ms-word:ofe|u| launcher + web fallback
  google_maps_api_key: '',                     // Street View (optional)
  options: {} }
```

## Navigation API — `useUI()` from `src/state/UIContext.jsx`

```js
const { activeTab, setActiveTab, profileCharacter, setProfileCharacter, openProfile } = useUI()
openProfile(filenameOrName, characters)  // routes to Profile tab; pass useVault().characters
```

## Styling

Dark noir theme only. Tokens (usable as Tailwind classes — `bg-panel`,
`text-ink-dim`, `border-edge`, `text-accent`, `bg-panel-2`, `text-teal`,
`text-rust`, `text-sage`, …) are defined in `src/styles.css` `@theme`.
Shared classes: `.btn`, `.btn-accent`, `.btn-danger`, `.input`, `.label`,
`.card`, `.estimate-badge`, `.prose-noir` (rendered markdown container).
Use them; avoid inventing parallel styles. Color roles: **amber accent** =
interactive/primary, **rust** = 1994 case / danger, **teal** = 2024
present-day, **sage** = ok/nature. Keep layouts calm and low-clutter;
comfortable information density for long writing sessions.

Render markdown via `renderMarkdown(md)` from `src/lib/markdown.js`
(returns sanitized HTML) inside `<div className="prose-noir" dangerouslySetInnerHTML=… />`.

## Library notes

- **Leaflet** (plain, no react-leaflet): `import L from 'leaflet'` and
  `import 'leaflet/dist/leaflet.css'`. Create the map in a `useEffect` with a
  container ref; destroy on unmount. Use `L.divIcon` with class `dp-pin`
  (styled in styles.css) — do NOT use the default marker icons (broken asset
  paths under Vite).
- **vis-timeline**:
  `import { Timeline } from 'vis-timeline/standalone'` and
  `import 'vis-timeline/styles/vis-timeline-graph2d.min.css'`.
  Dark restyle already exists in styles.css.
- **react-force-graph-2d**: `import ForceGraph2D from 'react-force-graph-2d'`.
  Measure the parent with a ref/ResizeObserver and pass explicit
  `width`/`height`.

## Hard rules

1. Every researched/period value is an **estimate — verify** and must be
   visibly flagged. Never invent data silently.
2. Vault files stay human-readable and Obsidian-compatible.
3. Everything seeded must be editable in the UI, and edits must persist via
   the `saveX` functions.
4. The app must run with zero configuration (no keys, no OneDrive URL):
   key-gated features disable gracefully with a short explanation.
5. Working names — nothing hard-coded that the user can't rename by editing
   data files or the UI.
