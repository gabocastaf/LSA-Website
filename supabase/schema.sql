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

-- Set by an admin's "Kick" action (app/frat-history/admin/actions.ts). Kicking also
-- bans the auth user via the service-role admin API; this column is what
-- lets the app show a status badge and force an immediate sign-out on a
-- kicked member's next request (utils/supabase/middleware.ts) without
-- waiting for their existing session to expire.
alter table public.profiles add column if not exists kicked boolean not null default false;

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

-- Lets an admin pin an event to the top of the home feed (e.g. formal, rush week).
alter table public.events add column if not exists pinned boolean not null default false;

-- Lets an admin hide test/junk/moderated events from the feed and this page
-- without deleting them (reversible, unlike deleteEvent).
alter table public.events add column if not exists hidden boolean not null default false;

alter table public.events add column if not exists attendance text not null default 'optional' check (attendance in ('optional', 'mandatory'));

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

-- Creator-only at the RLS layer; an admin editing/deleting someone else's
-- event goes through app/events/actions.ts's service-role client instead,
-- same "self-service RLS + admin override via service role" split used
-- throughout this app (see profiles above).
drop policy if exists "events_update_own" on public.events;
create policy "events_update_own"
  on public.events for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "events_delete_own" on public.events;
create policy "events_delete_own"
  on public.events for delete
  to authenticated
  using (created_by = auth.uid());

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
-- photos (Photo Gallery)
-- =========================================================
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  caption text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Lets an admin pin a photo to the top of the home feed.
alter table public.photos add column if not exists pinned boolean not null default false;

-- Lets an admin hide a photo from the feed and Photo Gallery without deleting
-- it (e.g. test uploads before real users join, or moderating uploads later).
alter table public.photos add column if not exists hidden boolean not null default false;

alter table public.photos enable row level security;

drop policy if exists "photos_select_authenticated" on public.photos;
create policy "photos_select_authenticated"
  on public.photos for select
  to authenticated
  using (true);

drop policy if exists "photos_insert_own" on public.photos;
create policy "photos_insert_own"
  on public.photos for insert
  to authenticated
  with check (uploaded_by = auth.uid());

drop policy if exists "photos_delete_own" on public.photos;
create policy "photos_delete_own"
  on public.photos for delete
  to authenticated
  using (uploaded_by = auth.uid());

-- Storage bucket backing the Photo Gallery. Public so images can be served
-- straight from their public URL with no signed-URL expiry to manage — this
-- is an internal frat photo dump, not sensitive data. storage.objects
-- already has RLS enabled by default in Supabase.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "photos_bucket_insert_authenticated" on storage.objects;
create policy "photos_bucket_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'photos');

drop policy if exists "photos_bucket_delete_own" on storage.objects;
create policy "photos_bucket_delete_own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'photos' and owner = auth.uid());

-- =========================================================
-- photo_tags (who's in a Photo Gallery photo)
-- =========================================================
create table if not exists public.photo_tags (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (photo_id, profile_id)
);

-- Unlike content tables (events, dues, photo_comments, etc.), both FKs here
-- cascade instead of set-null on purpose: a tag is metadata about who's IN someone
-- else's photo, not the tagged person's own content, so there's nothing to
-- preserve by nulling it out — deleting the photo or the tagged profile
-- should just remove the tag row.
alter table public.photo_tags enable row level security;

drop policy if exists "photo_tags_select_authenticated" on public.photo_tags;
create policy "photo_tags_select_authenticated"
  on public.photo_tags for select
  to authenticated
  using (true);

-- Only the photo's own uploader can tag people in it — v1 is
-- upload-time-only tagging (no editing existing photos), so this mirrors
-- that at the RLS layer via a subquery against photos.uploaded_by rather
-- than a column on this table.
drop policy if exists "photo_tags_insert_by_uploader" on public.photo_tags;
create policy "photo_tags_insert_by_uploader"
  on public.photo_tags for insert
  to authenticated
  with check (
    exists (
      select 1 from public.photos p
      where p.id = photo_id and p.uploaded_by = auth.uid()
    )
  );

-- No update/delete policy: tags are immutable after upload for v1.

-- =========================================================
-- photo_comments (Photo Gallery comments)
-- =========================================================
create table if not exists public.photo_comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

-- Comment text is content worth preserving (matches photos.uploaded_by /
-- thread_messages.author_id), so author_id set-nulls rather than cascades:
-- a deleted account's comments stick around, rendered under "Unknown", same
-- as an orphaned photo upload.
alter table public.photo_comments enable row level security;

drop policy if exists "photo_comments_select_authenticated" on public.photo_comments;
create policy "photo_comments_select_authenticated"
  on public.photo_comments for select
  to authenticated
  using (true);

drop policy if exists "photo_comments_insert_own" on public.photo_comments;
create policy "photo_comments_insert_own"
  on public.photo_comments for insert
  to authenticated
  with check (author_id = auth.uid());

drop policy if exists "photo_comments_delete_own" on public.photo_comments;
create policy "photo_comments_delete_own"
  on public.photo_comments for delete
  to authenticated
  using (author_id = auth.uid());

-- No update policy: comments are delete-and-repost, not editable. Admin
-- deletes of someone else's comment go through the service-role client
-- (see deleteComment in social-actions.ts), which bypasses RLS rather than
-- needing a second policy here.

-- =========================================================
-- photo_reactions (Photo Gallery emoji reactions)
-- =========================================================
create table if not exists public.photo_reactions (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  reaction_type text not null check (reaction_type in ('fire', 'heart', 'laugh', 'skull')),
  created_at timestamptz not null default now(),
  unique (photo_id, profile_id, reaction_type)
);

-- Unlike comments, a reaction is an identity-keyed vote about someone else's
-- content, not content of its own — closer to photo_tags than to a comment.
-- profile_id cascades (rather than set-null) so a deleted member's reactions
-- disappear cleanly instead of surviving as ownerless rows.
alter table public.photo_reactions enable row level security;

drop policy if exists "photo_reactions_select_authenticated" on public.photo_reactions;
create policy "photo_reactions_select_authenticated"
  on public.photo_reactions for select
  to authenticated
  using (true);

drop policy if exists "photo_reactions_insert_own" on public.photo_reactions;
create policy "photo_reactions_insert_own"
  on public.photo_reactions for insert
  to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "photo_reactions_delete_own" on public.photo_reactions;
create policy "photo_reactions_delete_own"
  on public.photo_reactions for delete
  to authenticated
  using (profile_id = auth.uid());

-- No update policy: toggling a reaction is insert-if-absent /
-- delete-if-present, never an update.

-- =========================================================
-- thread_messages (the Thread — general chapter banter)
-- =========================================================
create table if not exists public.thread_messages (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  author_id uuid references public.profiles (id) on delete set null,
  pinned boolean not null default false,
  -- Lets an admin hide a message from the feed and the Thread without deleting it.
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.thread_messages enable row level security;

drop policy if exists "thread_messages_select_authenticated" on public.thread_messages;
create policy "thread_messages_select_authenticated"
  on public.thread_messages for select
  to authenticated
  using (true);

drop policy if exists "thread_messages_insert_own" on public.thread_messages;
create policy "thread_messages_insert_own"
  on public.thread_messages for insert
  to authenticated
  with check (author_id = auth.uid());

-- No update/delete policy: no editing the record after the fact.

-- Publish thread_messages over Supabase Realtime so the Thread page can
-- stream new messages live instead of requiring a refresh. Guarded so
-- re-running this file doesn't error once the table is already published.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'thread_messages'
  ) then
    alter publication supabase_realtime add table public.thread_messages;
  end if;
end $$;

-- =========================================================
-- membership_events (roster history — joins are derived live from
-- profiles.created_at at feed-render time; this table only logs
-- admin-driven changes: promotions/demotions, retitles, kicks, and
-- reinstatements, since profiles only ever holds current state)
-- =========================================================
create table if not exists public.membership_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  -- Snapshot of the affected member's display_name/email at the time of the
  -- action — deliberately NOT resolved via a live join, so a promotion or
  -- kick record keeps showing a name even after the account is later
  -- deleted (this log shouldn't be the one place that goes blank).
  subject_label text not null,
  actor_id uuid references public.profiles (id) on delete set null,
  type text not null check (type in ('promoted', 'demoted', 'retitled', 'kicked', 'reinstated')),
  from_value text,
  to_value text,
  pinned boolean not null default false,
  -- Lets an admin hide a membership event (e.g. a test kick/promotion) from the feed.
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.membership_events enable row level security;

drop policy if exists "membership_events_select_authenticated" on public.membership_events;
create policy "membership_events_select_authenticated"
  on public.membership_events for select
  to authenticated
  using (true);

-- No client-side insert/update/delete policy: only ever written by
-- updateMember/kickMember (app/frat-history/admin/actions.ts) via the service-role
-- client, same reasoning as profiles itself.

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
