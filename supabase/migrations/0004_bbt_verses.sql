-- Bhagavad-gita As It Is, for the verse panel on the deployed site.
--
-- vedabase.io refuses requests from Vercel, and Vedabase's own advice was to
-- keep the book on our side. So the text imported from the BBT's EPUB
-- (scripts/import-bbt.ts) is uploaded here (scripts/upload-bbt.ts) and served
-- by api/verse.ts, a server function.
--
-- The text is the Bhaktivedanta Book Trust's copyright and is shown only
-- inside the app. So, unlike every other table, no browser may read it:
-- row-level security is on with no policies, and anon and authenticated lose
-- every privilege, so the publishable anon key and a signed-in reader's token
-- both see nothing. Only api/verse.ts reads it, with the service-role key,
-- which never leaves the server.
--
-- One row per section of the book, keyed like Vedabase's pages: '2/47', or
-- '1/16-18' where the book gives several verses one section. Re-runnable.

create table if not exists public.bbt_verses (
  page text primary key check (page ~ '^[0-9]{1,2}/[0-9]{1,2}(-[0-9]{1,2})?$'),
  sanskrit text not null,
  transliteration text not null,
  synonyms text not null,
  translation text not null check (char_length(translation) > 0),
  purport jsonb not null default '[]'::jsonb check (jsonb_typeof(purport) = 'array'),
  updated_at timestamptz not null default now()
);

alter table public.bbt_verses enable row level security;

revoke all on table public.bbt_verses from public, anon, authenticated;
grant select, insert, update, delete on table public.bbt_verses to service_role;
