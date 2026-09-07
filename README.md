# Gita Connects

Explore thematic connections between verses of the Bhagavad Gita as an interactive graph.

**Live:** https://gita-connects.vercel.app

Drag verses from the chapter sidebar onto a canvas, and the app draws the scholarly
connections between them — thematic, conceptual, devotional, philosophical, and more.
Draw your own connections, filter by type, and save networks for later.

## Features

- **Verse network canvas** — React Flow graph; drag verses in, auto-arrange with dagre
- **Typed connections** — 6 predefined types (thematic, conceptual, practical, devotional,
  philosophical, narrative) plus custom types you define
- **Draw your own edges** — connect two nodes, pick a type, set strength (1–10), add a description
- **Filtering** — show/hide connection types; selection persists across reloads
- **Verse detail** — Sanskrit, transliteration, translation, theme, concepts, and purport
- **Search palette** — `Cmd/Ctrl+K` to jump to any verse; `Cmd/Ctrl+S` to save the network
- **Save / load networks** — named snapshots in `localStorage`
- **Light and dark themes**
- **Mobile layout** — drawers and bottom sheets instead of side panels

## Current data coverage

37 verses across the 18 chapters, with 120 curated connections. All content lives in
[`src/data.ts`](src/data.ts). Chapter metadata (titles, Sanskrit names, verse counts) covers
all 18 chapters; verse-level content is a curated subset, not the full ~700 verses.

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

No backend, no database, no API keys. It is a fully client-side SPA.

## Getting started

Requires Node.js 20+.

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
| `npm run preview` | Serve the production build on port 4173 |

## Project structure

```
src/
  App.tsx               top-level layout, theme, panel state
  data.ts               chapters, verses, connections (all content)
  types.ts              Verse, Connection, Chapter
  connectionTypes.ts    predefined + custom types, localStorage helpers
  suggestions.ts        connection suggestions
  components/           VerseNetwork, VerseDetail, ChapterSidebar,
                        SearchPalette, ConnectionDialog, SaveLoadControls, ...
  hooks/                useMediaQuery, useBottomSheet
```

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
- Adding verses or connections means editing `src/data.ts` and redeploying; content is not
  externalized yet.
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
