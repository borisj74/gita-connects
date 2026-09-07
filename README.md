# Gita Connects

Explore thematic connections between verses of the Bhagavad Gita as an interactive graph.

**Live:** https://gita-connects.vercel.app

Drag verses from the chapter sidebar onto a canvas, and the app draws the scholarly
connections between them — sequential, thematic, progression, contrast, goal, dependency,
question–answer, definition, illustration, parallel.
Draw your own connections, filter by type, and save networks for later.

## Features

- **Verse network canvas** — React Flow graph; drag verses in, auto-arrange with dagre
- **Typed connections** — ten relation types: the verse-relationship model's five
  (sequential, thematic, progression, contrast, goal) plus dependency, question–answer,
  definition, illustration and parallel. Six are directional and drawn with arrowheads.
  Readers can also define custom types
- **Draw your own edges** — connect two nodes, pick a type, set strength (1–10), add a description
- **Filtering** — show/hide connection types; selection persists across reloads
- **Verse detail** — Sanskrit, transliteration, translation, theme, concepts, and purport
- **Search palette** — `Cmd/Ctrl+K` to jump to any verse; `Cmd/Ctrl+S` to save the network
- **Save / load networks** — named snapshots in `localStorage`
- **Light and dark themes**
- **Mobile layout** — drawers and bottom sheets instead of side panels

## Data and sources

All **701 verses** are present. Each carries Sanskrit, IAST transliteration, and
word-by-word glosses, imported from the public-domain
[gita/gita](https://github.com/gita/gita) dataset (Unlicense) by
[`scripts/import-verses.mjs`](scripts/import-verses.mjs).

**Prabhupada's text is displayed, never stored.** The Bhaktivedanta Book Trust has granted
this project permission to *display* the translation and purport from *Bhagavad-gītā As It
Is* — not to redistribute it. So that text is not in this repository and not in the built
bundle: [`api/verse.ts`](api/verse.ts) fetches a verse from vedabase.io when a reader opens
it and passes it through with the required attribution. The Sanskrit, transliteration and
synonyms shown in the panel come from the same fetch, so the verse matches Vedabase exactly;
the imported copy under `src/data/verses/` is the search index and offline fallback. See
[NOTICE](NOTICE) for the licence split.

During `vite dev` a small plugin in `vite.config.ts` runs the function locally; on Vercel
it deploys as a Function.

Of the 701 verses, **37 are hand-curated** — theme, concepts, a summary in our own words,
and 120 authored connections between them. The other **664 carry machine-proposed
concepts** from [`scripts/generate-concepts.mjs`](scripts/generate-concepts.mjs), marked
`unreviewed` in the UI until a person checks them. Every verse has at least two concepts
and belongs to one of eleven **theme clusters** ([`src/clusters.ts`](src/clusters.ts) —
Arjuna's dilemma, Soul and self, Duty and action, …); suggested connections come from
concept overlap and cluster membership at runtime, so no verse is a dead end.

Data is split by provenance:

| Path | Contents | Edit by hand? |
| --- | --- | --- |
| `src/data/verses/ch-NN.json` | Imported public-domain verse text | No — regenerate with the script |
| `src/data/curation.ts` | Reviewed themes, concepts, summaries, connections | Yes — this is the original work |
| `src/data/curation.generated.ts` | Machine-proposed concepts, `reviewed: false` | No — regenerate, or promote entries into `curation.ts` |
| `src/data/chapters.ts` | Chapter metadata | Yes |
| `src/data/index.ts` | Merges the above into the `Verse` the app consumes | — |

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | React 19 + TypeScript (strict) |
| Build | Vite 7 |
| Graph | React Flow 11 + dagre layout |
| Icons | lucide-react |
| Styling | Plain CSS with custom properties (no CSS framework) |
| Persistence | `localStorage` |
| Hosting | Vercel |

No database, no API keys. One serverless function (`api/verse.ts`) proxies vedabase.io;
everything else is client-side.

## Getting started

Requires Node.js 22.22.2+ (jsdom 30 and Vitest 5 both drop Node 20).

```bash
npm install
npm run dev
```

Opens on http://localhost:5173 (`strictPort` — the dev server fails rather than picking
another port if 5173 is taken).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on `0.0.0.0:5173` |
| `npm run build` | `tsc -b` type-check, then `vite build` — type errors fail the build |
| `npm run lint` | ESLint 9 flat config |
| `npm test` | Vitest in watch mode |
| `npm run test:run` | Vitest once (what CI runs) |
| `npm run preview` | Serve the production build on port 4173 |

## Project structure

```
src/
  App.tsx               top-level layout, theme, panel state
  data/                 verse text (imported) + curation (authored)
  types.ts              VerseText, VerseCuration, Verse, Connection, Chapter
  concepts.ts           the controlled concept vocabulary (Concept union type)
  clusters.ts           eleven theme clusters; every concept maps to one
  connectionTypes.ts    predefined + custom types, localStorage helpers
  suggestions.ts        connection suggestions
  components/           VerseNetwork, VerseDetail, ChapterSidebar,
                        SearchPalette, ConnectionDialog, SaveLoadControls, ...
  hooks/                useMediaQuery, useBottomSheet
  test/setup.ts         jsdom setup: matchMedia + ResizeObserver stubs
  **/*.test.ts(x)       tests live beside the code they cover
```

## Testing

Vitest with jsdom and React Testing Library. Tests sit next to their subject
(`src/suggestions.test.ts` beside `src/suggestions.ts`).

```bash
npm test          # watch mode
npm run test:run  # single run, as CI does
```

Coverage is on the pure logic and the data: connection-type persistence,
suggestion scoring, the `useMediaQuery` hook, `VerseNode` rendering and its
click handlers, the save/load/delete flow including corrupt-storage and
quota-exceeded paths, and a set of `src/data.ts` integrity checks (ids match
their chapter and verse, connections reference real verses, strengths stay in
range, no orphaned verses).

## Local data

Everything is stored under `gita-connects-*` keys in `localStorage`:

| Key | Contents |
| --- | --- |
| `gita-connects-saved-networks` | Named network snapshots |
| `gita-connects-custom-connection-types` | User-defined connection types |
| `gita-connects-active-filters` | Which connection types are visible |
| `gita-connects-theme` | `light` or `dark` |
| `gita-connects-connect-hint-dismissed` | Onboarding hint state |

Clearing site data resets the app to defaults. Nothing is sent to a server.

## Notes for contributors

- **`.js` extensions in imports are intentional** — required by the TypeScript
  `moduleResolution` setting. Do not rewrite them as extensionless.
- Add themes, concepts, or connections in `src/data/curation.ts`. Never hand-edit
  `src/data/verses/*.json` — rerun `node scripts/import-verses.mjs` instead.
- Concepts come from the fixed vocabulary in [`src/concepts.ts`](src/concepts.ts) and are
  typed, so an off-vocabulary tag fails the build. Adding a new idea means adding a term
  there on purpose — that is what keeps suggestions working.
- Do not add Prabhupada's translations or purports to this repo; link to Vedabase.
- Known gaps and planned work are tracked in [IMPROVEMENTS.md](IMPROVEMENTS.md).
- Common runtime problems are in [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
- Agent/automation setup notes are in [AGENTS.md](AGENTS.md).

## Deployment

Deployed on Vercel as a static build. [`vercel.json`](vercel.json) sets a strict
Content-Security-Policy plus `X-Content-Type-Options`, `X-Frame-Options`, and
`Referrer-Policy` headers. If you add an external script, font, or API call, the CSP must be
updated or the request will be blocked.

## License

[MIT](LICENSE)
