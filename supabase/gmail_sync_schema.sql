-- Gmail -> task background sync: schema
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).
--
-- These tables are deliberately NOT written to by the browser app directly
-- (except gmail_imports, which the client reads/claims). The OAuth token
-- tables are service-role-only so a Gmail refresh token can never reach the
-- client bundle, the same way the app's own Supabase anon key is safe to
-- ship because it's paired with RLS.

create table if not exists gmail_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  gmail_label_id text,
  gmail_label_name text,
  sync_cursor text,              -- Gmail historyId / last-seen internalDate, for incremental listing
  connected_at timestamptz default now(),
  last_synced_at timestamptz
);
alter table gmail_connections enable row level security;
-- No policies for anon/authenticated -> only the service-role key (used in
-- api/*.js serverless functions) can read or write this table; service-role
-- bypasses RLS by default so no explicit policy is needed for it.

create table if not exists gmail_oauth_state (
  state_token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text,                 -- 'web' | 'electron' - where to send the browser back after consent
  expires_at timestamptz not null,
  used boolean default false
);
alter table gmail_oauth_state enable row level security;
-- Service-role only, same reasoning as above.

create table if not exists gmail_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gmail_message_id text not null,
  gmail_label text,
  title text,
  snippet text,
  matched_by text default 'label',   -- future: 'ai'
  claimed boolean default false,
  created_at timestamptz default now(),
  claimed_at timestamptz,
  unique(user_id, gmail_message_id)
);
alter table gmail_imports enable row level security;

-- The client (with the user's own session) is allowed to read and claim its
-- own rows, but never insert/delete - only the service-role sync job inserts.
create policy "select own gmail imports" on gmail_imports
  for select using (auth.uid() = user_id);

create policy "claim own gmail imports" on gmail_imports
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
