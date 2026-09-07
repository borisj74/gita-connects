# Gita Connects — Improvements

Audit performed 2026-06-06. Items grouped by category; numbers are stable IDs for tracking.

## Data + Content

1. **Verse coverage low** — 38 of ~700 verses, 120 connections. Scaling options: load from JSON/CDN, lazy-load per chapter, or back with SQLite-via-wasm. *(done — 2026-09-07: all 701 verses imported from the public-domain gita/gita dataset. 37 remain curated; 664 have text but no theme or connections.)*
2. **No source attribution** — translation source missing (Prabhupada? Vyasa? AI?). Add `source` field + footer credit. *(resolved — 2026-09-07: the 37 translations were verbatim BBT text and have been removed. Verses now link to vedabase.io; Sanskrit/transliteration/glosses credit gita/gita in the README.)*
3. **Connections in source code** — content edits force redeploy. Move to JSON or headless CMS (Sanity / Notion / markdown). *(partly done — 2026-09-07: verse text is now JSON under src/data/verses/. Curation and connections are still in src/data/curation.ts.)*
4. **No commentary** — add `purport` field for verse depth. *(done — 2026-06-06)*

## Performance

5. **Whole `data.ts` (1239 lines) bundled** — split per chapter, dynamic import on expand. *(partly done — 2026-09-07: split into 18 per-chapter JSON files, but still eagerly imported. ~590 KB raw now in the bundle; dynamic import per chapter still outstanding.)*
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
31. **No tests** — add Vitest + React Testing Library. Test: drop verse, connect nodes, delete edge, save/load. *(done — 2026-09-07: 84 tests over data integrity, connectionTypes, suggestions, useMediaQuery, VerseNode, SaveLoadControls. VerseNetwork drag/connect still uncovered.)*
32. **ESLint warnings on hooks deps** — verify VerseNetwork callbacks include all deps.
33. **`.claude/launch.json`** — currently untracked. Add to `.gitignore` to keep that way.

51. **19 reciprocal connection pairs** — the same verse pair appears twice in
    `connections`, usually under two different types (e.g. `2.56`/`14.22` as both
    `thematic` and `conceptual`). Three share a type outright (`6.17`/`6.35`,
    `7.7`/`10.20`, `2.56`/`5.18`) and `4.7`→`18.66` repeats in the same direction
    under two types. Decide whether this is intentional; if not, dedupe and tighten
    the `data.test.ts` uniqueness check from the (from, to, type) triple to the
    unordered pair.

52. **664 uncurated verses** — all 701 verses now load, but only 37 have a theme, concepts,
    and connections. Needs a curation workflow: generating candidate concept tags from the
    word-by-word glosses for review is the likely path. The controlled vocabulary it depends
    on (item 53) is now in place, so this is unblocked.
    *(first pass done — 2026-09-07: `scripts/generate-concepts.mjs` proposes concepts and a
    placeholder theme for 551 of the 664, all `reviewed: false` and badged in the UI.
    Suggested connections follow from concepts at runtime. 113 verses scored below the
    threshold and remain uncurated. Review workflow: move an entry from
    `curation.generated.ts` into `curation.ts`, write a real theme, drop the flag.)*

55. **Review the 551 generated entries** — every one is a machine guess. Known misses:
    4.34 (the guru verse) scored below threshold for `guru`; `karma-yoga` was assigned once.
    Placeholder themes are just capitalised concept pairs ("Knowledge & Wisdom") and want
    real titles. Review chapter by chapter; the badge disappears as entries move to
    `curation.ts`.

56. **113 verses still untagged** — mostly narrative and list verses (ch. 1 army rosters,
    ch. 10 opulence lists) where the lexicon finds nothing decisive. Either lower
    `MIN_SCORE`, extend the lexicon, or tag by hand.

54. **Vocabulary needs review against the remaining 664** — the 36 terms were derived from
    the 37 curated verses only. Chapters 10, 11 and 17 are barely represented, so ideas like
    divine opulence, cosmic vision and the three kinds of faith may need terms of their own
    once curation reaches them. Revisit the list before bulk-tagging, not after.

53. **No controlled concept vocabulary** — 92 distinct concept tags across 37 verses, 64 of
    them used exactly once, so `suggestSimilar()` has little to match on. Define a fixed
    vocabulary as a union type and assert it in tests before curating the remaining 664.
    *(done — 2026-09-07: 36 terms in `src/concepts.ts`, typed as `Concept` so off-vocabulary
    tags fail the build. 92 tags collapsed to 36; singletons fell from 69% to 22%; verses
    with at least one suggestion went from 31/37 to 37/37.)*

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
