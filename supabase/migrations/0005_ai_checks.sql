-- One row per "Check with AI" request, so api/check.ts can hold each signed-in
-- reader to a daily allowance of TypeSafe calls.
--
-- Like bbt_verses, no browser touches it: row-level security is on with no
-- policies and anon and authenticated hold no privileges, so a reader cannot
-- read or reset their own count. Only api/check.ts reads and writes it, with
-- the service-role key. Holds no content: who checked, when, and how many
-- links. Re-runnable.

create table if not exists public.ai_checks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  links integer not null check (links >= 0),
  created_at timestamptz not null default now()
);

create index if not exists ai_checks_user_time on public.ai_checks (user_id, created_at desc);

alter table public.ai_checks enable row level security;

revoke all on table public.ai_checks from public, anon, authenticated;
grant select, insert, delete on table public.ai_checks to service_role;
