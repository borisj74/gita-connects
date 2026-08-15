# AGENTS.md

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
