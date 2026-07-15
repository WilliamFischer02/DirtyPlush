# Dirty Plush — Writer's Panel

A command center for writing the novel *Dirty Plush*. It is a single dark, calm web page with five tabs — Setting Map, Timeline & Structure, Characters & Themes, Profile, and Resources — that all read and write the same folder of plain files: your Obsidian vault. Pin the body site in the Pala backcountry, drag the 1994 case and the 2024 interrogation frame around on one timeline, untangle who is lying to whom on the relationship graph, and keep every researched period detail honestly labeled until you have verified it yourself. The app stores nothing anywhere else; your notes stay your notes.

## Quick start

```
npm install
npm run dev
```

Then open http://localhost:5173 in Chrome or Edge.

The app starts fully loaded with the sample vault (characters, events, map pins, beats), so you can explore before connecting anything of your own.

## Pointing the app at your Obsidian vault

Click **Connect vault folder** in the top-right bar and pick your vault folder (or any folder — a new empty one works fine). The app asks once for read/write permission and remembers the folder across visits.

If the folder is missing any of the panel's starter files, the app offers to create them. Existing files are never overwritten. What gets created:

```
your-vault/
  writers-panel-config.json     settings (manuscript links, optional Maps key)
  arcs.csv                      character arcs, one row per character
  characters/*.md               one Markdown note per character
  timeline/events.json          events on the dual 1994 / 2024 timeline
  structure/beats.json          the novel's structural beats and chapters
  map/locations.geojson         map pins and regions, with period details
  resources/resources.json      links: manuscript, case files, writing craft
```

Three promises about these files:

- **Plain text, always.** Markdown, JSON, and CSV — readable in any editor, and the character notes use ordinary Obsidian properties (YAML frontmatter). Nothing is ever locked in.
- **Obsidian and the panel share the same files.** Edit a character note in Obsidian, come back, click **Reload** in the top bar, and the change is there. Every edit you make in the panel is written straight back to the same files.
- **You can always take everything with you.** **Export** downloads the whole vault as a zip; **Import** loads one back in.

If your browser can't open folders (see below), the app quietly works from browser storage instead — everything functions, and the zip Export/Import buttons are how you move your work in and out.

## Browser requirements

Connecting a real folder uses the File System Access API, which today means a Chromium browser: **Chrome or Edge**. Everything else — every tab, every editor — works in any modern browser (Firefox, Safari) via the browser-storage fallback plus zip import/export.

## Optional integrations

All of these are **off by default, and the app fully works without them**. Each one disables gracefully with a short explanation rather than pretending.

**Google Maps API key — Street View only.** With a key, you can stand on any map pin and look around in present-day Street View (the overlay reminds you: present-day imagery, 1994 details remain estimates). Get a key from the [Google Cloud Console](https://console.cloud.google.com/) — create a project, enable the *Maps JavaScript API*, and copy the key (Google requires a billing account, but light personal use fits the free tier). Paste it under **Resources → Settings**. Without a key, the Street View button simply explains what's missing; the app never contacts Google keyless.

**OneDrive manuscript links.** The novel itself lives in Word/OneDrive, outside the vault. In **Resources → Settings** you can set two URLs: one that the "Open in Word (desktop)" button hands to installed Word via the `ms-word:` protocol, and a web fallback that opens the OneDrive editor in a new tab. To get a link: open your document on onedrive.live.com (or in Word), choose **Share → Copy link**, and paste it in. Until they're set, the buttons stay disabled with a pointer to Settings.

**Microsoft Graph — live OneDrive folder.** The Resources tab can list a OneDrive folder live (read-only), alongside the editable manifest. It needs a free Azure "app registration" — a five-minute, one-time setup:

1. Go to [portal.azure.com](https://portal.azure.com) → search **App registrations** → **New registration**.
2. Name it anything (e.g. *Dirty Plush Panel*). Under *Supported account types* pick **Personal Microsoft accounts only** (that's where personal OneDrive lives).
3. Under *Redirect URI*, choose platform **Single-page application (SPA)** and enter `http://localhost:5173`. After you deploy, come back and add your deployed address (e.g. `https://your-app.vercel.app`) as a second SPA redirect URI.
4. Register, then copy the **Application (client) ID** from the overview page.
5. In OneDrive, right-click your case-file folder → **Share → Copy link**.
6. Paste both — the client ID and the folder link — under **Resources → Settings → Microsoft Graph**, set the account type to *Personal*, and save. Then click **Sign in to Microsoft** on the Live OneDrive folder panel.

No secret is ever stored; sign-in is Microsoft's own popup (PKCE), the app asks only for read access (`Files.Read.All`), and the session lives in your browser tab. Without the config, the panel simply explains how to turn it on.

## Making it yours

Under **Resources → Appearance** you can change the accent color (presets or any custom color), the text size, which tab opens first, and the map's default base layer — all saved into `writers-panel-config.json` in your vault, applied instantly, and reset-able by simply deleting the block from the file.

A few quality-of-life features worth knowing:

- **Ctrl+K / ⌘K opens the command palette** — one search box over every character, event, place, beat, and link in the vault. Enter jumps straight there: characters open in Profile, events open their full editor on the Timeline, places select and fly to their pin on the Map.
- **Obsidian `[[wikilinks]]` are live.** Write `[[Lucia Serrano]]` (or `[[Det. Jack Brennan|Brennan]]`) in any note body, event detail, location note, or beat craft text — in preview it becomes a click-through to that character's profile, exactly like in Obsidian.
- **Keys 1–5** switch tabs from anywhere (as long as you're not typing in a field).
- The timeline toolbar has a **filter box** — type a word and only matching events stay on the tracks.
- On the map, **◎** saves your current position and zoom as the *home view* — the map opens there from then on — and **⌂** flies back to it.
- Timeline events have a **Duplicate** button (great for recurring beats), and the structure track supports adding, deleting, and reordering beats with the ◀ ▶ controls.
- Every destructive action asks first in a proper dialog, every save is confirmed with a quiet toast naming the exact file it wrote, and closing the tab with unsaved edits warns you first.

## The data model

Everything the panel knows lives in the vault:

- `writers-panel-config.json` — the settings above; safe to edit by hand.
- `characters/*.md` — one note per character. Properties (`name`, `role`, `relationships`, `theme_stance`, `arc_begin`, `arc_end`) drive the graph and arcs; the Markdown body is your free-form profile. Relationships are plain strings like `Jack Brennan :: partner`, with `(hidden)` marking in-story secrets (drawn dashed).
- `timeline/events.json` — every event, tagged to the 1994 case or the 2024 frame, with dates, weight, priority, structural beat, and full Markdown detail.
- `structure/beats.json` — the beat sheet: order, chapter, one-liner, and longer craft notes.
- `arcs.csv` — each character's arc, beginning to end. The panel keeps this in sync with the character notes so Obsidian and the app never disagree.
- `map/locations.geojson` — pins and regions, each with a summary, Markdown notes, and a list of period fields (gas prices, flora, radio stations…).
- `resources/resources.json` — every link, in three categories: novel, case-file, writing.

One rule runs through all of it: **every researched 1994 value ships flagged "estimate — verify."** Gas at $1.11/gal, the chamise on the hillsides — these are starting points, not facts. Each one is editable in the UI, and correcting or confirming them is the author's work, on purpose.

## Deploying

The panel is a static site — any static host over HTTPS works (Vercel, Netlify, GitHub Pages).

```
npm run build
```

then publish the `dist/` folder. HTTPS matters: browsers only allow folder access on secure pages (localhost counts, which is why `npm run dev` just works).

## Development notes

React 18 + Vite 6 + Tailwind CSS v4, plain JSX. Data and navigation live in `src/state/` (the `useVault()` and `useUI()` hooks); each tab is a folder under `src/components/`; file backends and parsers are in `src/lib/`; the seed vault is `vault-sample/`. The binding internal contract — data shapes, hooks, styling — is `docs/CONTRACT.md`.
