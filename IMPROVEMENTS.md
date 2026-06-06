# Gita Connects — Improvements

Audit performed 2026-06-06. Items grouped by category; numbers are stable IDs for tracking.

## Data + Content

1. **Verse coverage low** — 38 of ~700 verses, 120 connections. Scaling options: load from JSON/CDN, lazy-load per chapter, or back with SQLite-via-wasm.
2. **No source attribution** — translation source missing (Prabhupada? Vyasa? AI?). Add `source` field + footer credit.
3. **Connections in source code** — content edits force redeploy. Move to JSON or headless CMS (Sanity / Notion / markdown).
4. **No commentary** — add `purport` field for verse depth. *(done — 2026-06-06)*

## Performance

5. **Whole `data.ts` (1239 lines) bundled** — split per chapter, dynamic import on expand.
6. **`verses.find()` / `connections.filter()` everywhere** — O(n) per render. Build `Map<id, Verse>` + `Map<id, Connection[]>` once.
7. **`ChapterSidebar` re-renders all 18 chapters + nested verses** — wrap items in `memo`, virtualize with `react-window` for long lists.
8. **`filteredEdges` recomputes on every `allEdges` change** — fine, but pair grouping `Map` rebuilds; cache by edge id.
9. **No code splitting** — `reactflow` is heavy (~150kb). Lazy-import `VerseNetwork`.

## UX

10. **No undo/redo** — accidental "Clear All" or edge delete = lost work. Add history stack.
11. **Empty network requires sidebar drag** — add "Add random verse" + "Add starter set" buttons.
12. **No mobile layout** — sidebar + canvas don't work <768px. Need drawer pattern + touch handles.
13. **Drag from sidebar = no visual ghost on canvas** — show drop preview rectangle.
14. **Auto Arrange uses grid** — replace with force-directed (`d3-force`) or `dagre` for tree-like layout.
15. **No keyboard shortcuts** — `⌫` delete node, `⌘Z` undo, `/` focus search, `⌘S` save, `Esc` close detail.
16. **VerseDetail opens but no way to "open as node"** — add "Add to network" button.
17. **Search results don't highlight match** — bold matched substring.
18. **Connection types color clash with verse-id badge** — review palette contrast.
19. **No zoom-to-node** — clicking sidebar verse should pan/zoom canvas to its node if present.
20. **No filter persistence** — active filters reset on reload. Persist to localStorage.

## Accessibility

21. **Reactflow nodes not keyboard-navigable by default** — add `tabIndex={0}` + arrow-key nav.
22. **× delete buttons hover-only** — invisible to keyboard users. Show on focus too.
23. **Modals lack focus trap** — `ConnectionDialog` / `SaveLoadControls` modals miss `aria-modal`, `role="dialog"`, focus return.
24. **Color-only differentiation** for connection types — add icon or pattern per type.
25. **Sanskrit text** no `lang="sa"` attribute. Transliteration `lang="sa-Latn"`. Helps screen readers + fonts.
26. **No reduced-motion respect** for node fade-in (only present for `index.css` animations).

## Code Quality

27. **`VerseNetwork.tsx` is 505 lines** — split: extract `useNetworkState`, `useDragDrop`, `useEdgeFiltering` hooks.
28. **Multiple `setTimeout(fitView, 100)`** — race-prone. Use `requestAnimationFrame` chain or `flushSync`.
29. **`forwardRef + useImperativeHandle`** for `handleClearAll` / `handleAutoArrange` / `loadNetwork` — could lift to context or pass callbacks downward. Imperative ref is an escape hatch.
30. **Data IDs as strings (`"2.47"`)** — fragile; consider typed branded `VerseId`.
31. **No tests** — add Vitest + React Testing Library. Test: drop verse, connect nodes, delete edge, save/load.
32. **ESLint warnings on hooks deps** — verify VerseNetwork callbacks include all deps.
33. **`.claude/launch.json`** — currently untracked. Add to `.gitignore` to keep that way.

## Persistence + Saved Networks

34. **localStorage only** — no cross-device. Optional: Vercel KV / Supabase auth + cloud save.
35. **No export** — add "Export PNG" (canvas screenshot via `html-to-image`) + "Export JSON".
36. **Share URL** — encode network state in URL hash → shareable links.

## Visual Polish

37. **VerseNode overflow** — long themes truncate via `node-theme` absolute position. Add `text-overflow: ellipsis`.
38. **Edge labels overlap on dense graphs** — parallel offset helps; consider showing label only on hover.
39. **Scissors button small** — bigger hit target (32×32) for touch.
40. **Empty state for network** — copy is good; add subtle illustrated graphic.
41. **Connection dialog UX** — selecting type, then strength slider, then description = many steps. Make optional.
42. **Filter bar** in header is hidden behind dropdown. Make connection counts visible per type.
43. **Theme**: light only. Add dark mode (already has CSS vars — easy swap).

## Architecture / Build

44. **No state library** — local `useState` everywhere. Adding zustand/jotai would simplify cross-component state (selected, network, filters).
45. **Vite default config** — add `vite-plugin-pwa` for offline reading (verse explorer is read-heavy).
46. **No analytics** — Vercel Analytics free tier for usage insight.
47. **`npm audit` 8 vulns** — run `npm audit fix` to address.

## SEO / Discoverability

48. **Single `<h1>`, no meta tags** — add Open Graph image, `<meta description>`, sitemap.
49. **Each verse has no URL** — route `/verse/2.47`. Currently SPA-only state.
50. **No prerender** — Vite static. Consider Astro or Next.js for SSR of verse pages → indexable.
