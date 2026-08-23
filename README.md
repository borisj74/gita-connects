# Gita Connects

Interactive verse explorer for the Bhagavad Gita. Drop verses onto a canvas, draw and label connections between them, and discover related verses.

**Live:** https://gita-connects.vercel.app

## Stack

React 19, TypeScript, Vite 7, reactflow, dagre (lazy-loaded for auto-layout). Client-side only — state persists to `localStorage`.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint
npm run preview  # http://localhost:4173
```

CI requires `npm run build && npm run lint` to pass.

## Docs

See [AGENTS.md](./AGENTS.md) for architecture, state ownership, and agent-oriented gotchas.
