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

## How syncing behaves

Signing in starts a mirror; it never takes over. Reads always come from
localStorage, so the app stays fast and works offline.

- **On sign-in** the two sides are merged as a union, newer edit wins. Nothing
  is deleted at this point: the reader may have worked on either device and
  neither list is authoritative yet.
- **After that** local edits are pushed, debounced, as changes measured against
  a snapshot taken at the end of the last successful sync. Deletions can only
  be recognised that way — an id missing from a first pull just means this
  device never had it.
- **`updated_at` is the client's timestamp**, not the moment of upload. An edit
  made offline and pushed hours later must still lose to a newer edit made
  elsewhere, so the server triggers that would have stamped `now()` on every
  upsert were removed (migration 0003).
- **Signing out** stops the mirror and leaves this device's copy untouched.
- **Custom link types** merge per type, like notes. **Preferences** are a
  single row, so theme, hidden filters and open panel sections win or lose
  together rather than being merged field by field.
- **A mount is not an edit.** Persisting settings on load would stamp them and
  make whichever device opened last win every merge, so writes are stamped
  only when the stored value actually changes.

Last-write-wins is the right model for one person on two devices, which is
what this is for. It is not enough for two people editing at once.

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
