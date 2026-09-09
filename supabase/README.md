# Cloud storage

Signing in is optional. Without an account the app keeps everything in the
browser's localStorage, exactly as it always has. With an account the same
work is mirrored to Postgres so it follows the reader to another device.

## What is stored

Four tables, all per-user and all behind row-level security
(`user_id = auth.uid()`), so the browser can talk to PostgREST directly with
the reader's own token and no server code sits in between:

| Table | Holds |
| --- | --- |
| `networks` | A saved canvas: name, nodes, edges |
| `notes` | One personal note per verse |
| `link_types` | Link types the reader invented |
| `preferences` | Theme, hidden filters, open detail sections |

**No verse text is ever stored.** Networks reference verses by id (`2.47`);
translations and purports are fetched from vedabase.io when a verse is opened.
The Bhaktivedanta Book Trust permits display, not redistribution.

## Applying the schema

Migrations live in `supabase/migrations/` and are written to be re-runnable,
so the runner simply plays them all in name order:

```bash
vercel env pull        # writes .env.local (never committed)
npm run db:migrate
```

## Manual steps in the dashboards

Two things the CLI cannot do:

1. **Auth redirect URLs** — in the Supabase dashboard under Authentication →
   URL Configuration, add the production origin (e.g.
   `https://gita-connects.vercel.app`) to the redirect allow-list. `localhost`
   is permitted by default, which is why development works with no setup.
2. **Preview environment variables** — `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` are set for Production and Development. The CLI
   prompt for Preview could not be completed non-interactively; add them from
   the Vercel dashboard if preview deployments need to sign in.

`VITE_`-prefixed variables are visible to anyone loading the site. That is
correct here: the anon key is the publishable key, and row-level security is
what actually protects the data.
