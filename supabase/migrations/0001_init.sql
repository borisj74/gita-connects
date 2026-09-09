-- Cloud storage for a signed-in reader's work.
--
-- Everything here is per-user and private: row-level security limits every
-- row to its owner, and the browser talks to PostgREST directly with the
-- user's own token, so there is no server code that could leak across users.
--
-- What is deliberately NOT stored: any verse text. Networks reference verses
-- by id ('2.47'); translations and purports are fetched from vedabase.io when
-- a verse is opened. The Bhaktivedanta Book Trust permits display, not
-- redistribution, and that stays true in the cloud.

create extension if not exists pgcrypto;

-- Keep updated_at honest without trusting the client.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- A saved network: the canvas as the reader arranged it.
create table if not exists public.networks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  selected_verse_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists networks_user_updated_idx
  on public.networks (user_id, updated_at desc);

-- One personal note per verse.
create table if not exists public.notes (
  user_id uuid not null references auth.users (id) on delete cascade,
  verse_id text not null check (verse_id ~ '^[0-9]{1,2}\.[0-9]{1,3}$'),
  body text not null check (char_length(body) between 1 and 20000),
  updated_at timestamptz not null default now(),
  primary key (user_id, verse_id)
);

-- Link types the reader invented, beyond the seven built in.
create table if not exists public.link_types (
  user_id uuid not null references auth.users (id) on delete cascade,
  type_id text not null,
  label text not null check (char_length(label) between 1 and 80),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  directional boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, type_id)
);

-- Small UI state worth carrying between devices.
create table if not exists public.preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text check (theme in ('light', 'dark')),
  hidden_filters jsonb not null default '[]'::jsonb,
  detail_sections jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array['networks', 'notes', 'link_types', 'preferences'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger touch_%1$s before update on public.%1$s
         for each row execute function public.touch_updated_at()', t);
    execute format('alter table public.%1$s enable row level security', t);
    -- One policy per table: you may see and change your own rows, nothing else.
    execute format('drop policy if exists own_rows on public.%1$s', t);
    execute format(
      'create policy own_rows on public.%1$s
         for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
    -- Anonymous visitors get nothing; the app keeps their work in the browser.
    execute format('revoke all on public.%1$s from anon', t);
  end loop;
end;
$$;
