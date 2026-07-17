-- Ligma Sigma Alpha — core schema
-- Run this in the Supabase Dashboard: SQL Editor -> New Query -> paste -> Run.
-- Safe to re-run (drops/recreates policies and the trigger function).

create extension if not exists pgcrypto;

-- =========================================================
-- profiles
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  pledge_class text,
  frat_title text not null default 'Pledge',
  role text not null default 'pledge' check (role in ('pledge', 'active', 'admin')),
  demerits integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- No client-side insert/update/delete policy on profiles: the signup trigger
-- (SECURITY DEFINER, below) creates rows, and all admin actions (promoting
-- a Pledge to Active, assigning frat_title, adjusting demerits) go through
-- server actions using the service_role key, which bypasses RLS entirely.
-- This prevents a signed-in member from promoting themselves to admin.

-- =========================================================
-- events
-- =========================================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date timestamptz not null,
  location text,
  description text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

drop policy if exists "events_select_authenticated" on public.events;
create policy "events_select_authenticated"
  on public.events for select
  to authenticated
  using (true);

drop policy if exists "events_insert_own" on public.events;
create policy "events_insert_own"
  on public.events for insert
  to authenticated
  with check (created_by = auth.uid());

-- =========================================================
-- event_rsvps
-- =========================================================
create table if not exists public.event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'going' check (status in ('going', 'maybe', 'not_going')),
  created_at timestamptz not null default now(),
  unique (event_id, profile_id)
);

alter table public.event_rsvps enable row level security;

drop policy if exists "rsvps_select_authenticated" on public.event_rsvps;
create policy "rsvps_select_authenticated"
  on public.event_rsvps for select
  to authenticated
  using (true);

drop policy if exists "rsvps_insert_own" on public.event_rsvps;
create policy "rsvps_insert_own"
  on public.event_rsvps for insert
  to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "rsvps_update_own" on public.event_rsvps;
create policy "rsvps_update_own"
  on public.event_rsvps for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "rsvps_delete_own" on public.event_rsvps;
create policy "rsvps_delete_own"
  on public.event_rsvps for delete
  to authenticated
  using (profile_id = auth.uid());

-- =========================================================
-- awards (Trophy Cabinet)
-- =========================================================
create table if not exists public.awards (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  reason text,
  given_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.awards enable row level security;

drop policy if exists "awards_select_authenticated" on public.awards;
create policy "awards_select_authenticated"
  on public.awards for select
  to authenticated
  using (true);

drop policy if exists "awards_insert_own" on public.awards;
create policy "awards_insert_own"
  on public.awards for insert
  to authenticated
  with check (given_by = auth.uid());

-- =========================================================
-- quotes (Quote Book / Kangaroo Court)
-- =========================================================
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_text text not null,
  attributed_to uuid references public.profiles (id) on delete set null,
  submitted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.quotes enable row level security;

drop policy if exists "quotes_select_authenticated" on public.quotes;
create policy "quotes_select_authenticated"
  on public.quotes for select
  to authenticated
  using (true);

drop policy if exists "quotes_insert_own" on public.quotes;
create policy "quotes_insert_own"
  on public.quotes for insert
  to authenticated
  with check (submitted_by = auth.uid());

-- =========================================================
-- beefs (Beef Tracker)
-- =========================================================
create table if not exists public.beefs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  target text,
  reason text,
  status text not null default 'active' check (status in ('active', 'squashed')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.beefs enable row level security;

drop policy if exists "beefs_select_authenticated" on public.beefs;
create policy "beefs_select_authenticated"
  on public.beefs for select
  to authenticated
  using (true);

drop policy if exists "beefs_insert_own" on public.beefs;
create policy "beefs_insert_own"
  on public.beefs for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "beefs_update_own" on public.beefs;
create policy "beefs_update_own"
  on public.beefs for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- =========================================================
-- dues (Chapter Dues ledger)
-- =========================================================
create table if not exists public.dues (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount numeric(10, 2) not null,
  paid_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.dues enable row level security;

drop policy if exists "dues_select_authenticated" on public.dues;
create policy "dues_select_authenticated"
  on public.dues for select
  to authenticated
  using (true);

drop policy if exists "dues_insert_own" on public.dues;
create policy "dues_insert_own"
  on public.dues for insert
  to authenticated
  with check (paid_by = auth.uid());

-- =========================================================
-- Auto-create a profile row whenever a new auth.users row appears
-- (i.e. right after someone completes the magic-link signup).
-- SECURITY DEFINER is required: at insert time the new user has no
-- session yet, so without this the insert would be blocked by RLS.
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, frat_title, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    'Pledge',
    'pledge'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
