# AGENTS.md

## Project overview

Gita Connects is an interactive verse explorer for the Bhagavad Gita. Users drop verses onto a canvas, draw and label connections between them, and discover related verses.

- **Live:** https://gita-connects.vercel.app (Vercel auto-deploys on push to `master`)
- **Repo:** https://github.com/borisj74/gita-connects
- **Package name:** `gita-connects`
- **No backend** — client-side state; persistence is `localStorage`.

## Stack

- React 19 + TypeScript + Vite 7
- reactflow 11 — canvas/graph
- dagre 1.x — tree auto-layout (lazy-loaded only on Auto Arrange)
- lucide-react — icons
- Node 20+ recommended

## Commands & CI

Standard commands are in `package.json` scripts:

- `npm run dev` — `:5173` (see Cursor Cloud section for host/strictPort details)
- `npm run build` — `tsc -b` then `vite build` (type-checked; type errors fail the build)
- `npm run lint` — flat-config ESLint 9
- `npm run preview` — `:4173`

**CI gate:** `npm run build && npm run lint` must both pass.

## Architecture

Single-page app. `App.tsx` owns top-level state; `VerseNetwork.tsx` owns the canvas.

```
App.tsx
├── ChapterSidebar — left drawer: chapters → verses (drag onto canvas)
├── main-content
│   ├── canvas-actions — search, Save, Load, Connections filter, Auto Arrange, Clear All
│   ├── theme-toggle-btn
│   ├── VerseNetwork — reactflow canvas
│   │   ├── VerseNode, ConnectionEdge, Controls/Panels, ConnectionDialog
│   └── canvas-zoom / undo-redo
├── VerseDetail — right overlay for selected verse
└── SearchPalette — ⌘K / `/` command palette (not SearchBar)
```

### Data files

| File | Purpose |
|------|---------|
| `src/data.ts` | Hand-authored chapters, verses, connections (`{from, to, type, description, strength}`) |
| `src/types.ts` | `Verse`, `Chapter`, `Connection` |
| `src/connectionTypes.ts` | Predefined types, custom-type create/persist, active-filter persist, colors |
| `src/suggestions.ts` | `suggestSimilar(verseId)` by shared-concept overlap |

### State ownership

- **App:** `selectedVerseId`, `sidebarOpen`, `customTypes`, `activeFilters`, `networkVerses`, `networkEdges`, `theme`, `searchOpen`, `mobileMenuOpen`
- **VerseNetwork:** `nodes`, `allEdges`, `networkVerses`, undo/redo; exposes `VerseNetworkRef` imperative API (`handleAutoArrange`, `handleClearAll`, `getNetworkState`, `loadNetwork`, `removeEdgesByType`, `undo`, `redo`, `focusNode`, `addVerse`, `addConnection`)
- **Sync:** `onNetworkVersesChange`, `onNetworkEdgesChange`, `onHistoryChange`

## Key rendering rules (non-obvious)

- **One chip per verse-pair:** `filteredEdges` collapses multiple connections between the same two verses to the single strongest edge. `VerseDetail` connected-verses list dedupes the same way.
- **Spotlight:** selecting a verse dims non-neighbor nodes/edges; hover restores; closing detail clears.
- **History:** `commit()` before mutations; undo/redo via ref-mirrored snapshot stack; sync refs in `useEffect` never during render (react-hooks/refs).
- **dagre:** lazy import inside `handleAutoArrange` keeps it out of the main bundle.

## Persistence (`localStorage` keys)

- `gita-connects-saved-networks`
- `gita-connects-custom-connection-types`
- `gita-connects-active-filters`
- `gita-connects-theme`
- `gita-connects-connect-hint-dismissed`

All reads use try/catch; `setItem` guarded for quota. `ErrorBoundary` at top level.

## Conventions

- CSS variables for theming; `[data-theme="dark"]` overrides mostly in `src/index.css`. When adding a hardcoded color, add a dark override.
- Component-scoped CSS files are **global** (no CSS modules) — class names must stay unique.
- `vercel.json` sets CSP + security headers — update CSP if adding external origins.
- **`.js` extensions in imports are intentional.** TypeScript files import local modules with `.js` extensions (e.g. `'./hooks/useMediaQuery.js'`). Required by TS `moduleResolution` — do not "fix" to extensionless imports.

## Deploy

Push to `master` triggers production deploy. No preview/staging branch flow.

## Known gaps / next ideas

- Highest-leverage next feature: shareable URLs encoding network state (no backend).
- No accounts/cloud sync.
- Other ideas: full verse content + audio, paths-between-two-verses, export PNG/PDF, spaced-repetition.

## Cursor Cloud specific instructions

Gita Connects is a **single, client-side-only** Vite + React 19 + TypeScript SPA
(package name `gita-connects`). It visualizes thematic connections between
Bhagavad Gita verses using React Flow. There is **no backend, database, API, or
Docker** — all verse/connection data lives in `src/data.ts` and state persists to
`localStorage`. So there is nothing to provision; just run the single frontend.

Standard commands are defined in `package.json` scripts; use those rather than
duplicating them here:

- Dev server: `npm run dev` — serves on `0.0.0.0:5173` with `strictPort` (Vite
  fails instead of picking another port if 5173 is taken). The update script
  already runs `npm install`, so dependencies are ready when an agent starts.
- Lint: `npm run lint` (flat-config ESLint 9).
- Build: `npm run build` — runs `tsc -b` first, then `vite build`. This is a
  type-checked build; type errors fail the build. Vite `preview` runs on port
  `4173`.

Non-obvious caveats:

- **`.js` extensions in imports are intentional.** TypeScript files import local
  modules with `.js` extensions (e.g. `import ... from './App.tsx'` /
  `'./hooks/useMediaQuery.js'`). This is required by the TS `moduleResolution`
  config — do not "fix" them to extensionless imports.
- **`npm audit` reports vulnerabilities** (transitive dev-dependency advisories).
  These are known and do not block dev/build/lint; do not run `npm audit fix`
  as part of setup.
- The `.claude/hooks/session-start.sh` hook only runs `npm install` under
  Claude Code web (`CLAUDE_CODE_REMOTE=true`); it is not used by Cursor Cloud.
