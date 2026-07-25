-- ============================================================================
-- Nexis OS — 0001 core
-- Identity, roles, departments, and the RLS primitives every module builds on.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Org-wide authority. Department-level authority is separate (see
-- department_members.is_manager) so someone can lead Marketing while being an
-- ordinary member of Events.
create type app_role as enum ('super_admin', 'manager', 'member');

-- ---------------------------------------------------------------------------
-- Departments
-- ---------------------------------------------------------------------------

create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  description text,
  -- Lucide icon name + brand-palette accent, so the UI can render a department
  -- consistently anywhere it appears without a lookup table in the client.
  icon        text not null default 'building-2',
  color       text not null default '#EF3A5D',
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles — one row per auth.users row
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  email                 text not null,
  full_name             text not null default '',
  -- E.164 (+919733127000). The reminder engine reads this directly.
  phone                 text,
  avatar_url            text,
  role                  app_role not null default 'member',
  job_title             text,
  primary_department_id uuid references public.departments(id) on delete set null,
  is_active             boolean not null default true,
  -- Per-user delivery preferences for the reminder engine.
  whatsapp_opt_in       boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index profiles_department_idx on public.profiles (primary_department_id);
create index profiles_role_idx on public.profiles (role);

-- A person can sit in several departments; primary_department_id is just their
-- home base for defaults and dashboard framing.
create table public.department_members (
  department_id uuid not null references public.departments(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  is_manager    boolean not null default false,
  created_at    timestamptz not null default now(),
  primary key (department_id, user_id)
);

create index department_members_user_idx on public.department_members (user_id);

-- ---------------------------------------------------------------------------
-- Auth wiring
-- ---------------------------------------------------------------------------

-- Every new auth user gets a profile automatically. Metadata passed at signup
-- (full_name, phone) is carried across; role always defaults to 'member' and
-- must be elevated deliberately by a super admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at honest without every caller remembering to set it.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helpers
--
-- These are SECURITY DEFINER on purpose: a policy on `profiles` that itself
-- queries `profiles` would recurse infinitely. Running as definer bypasses RLS
-- inside the function and breaks the cycle. They are STABLE so Postgres can
-- cache them per statement rather than re-running per row.
-- ---------------------------------------------------------------------------

create or replace function public.current_role_of(uid uuid default auth.uid())
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = uid and is_active;
$$;

create or replace function public.is_super_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'super_admin' from public.profiles where id = uid and is_active),
    false
  );
$$;

-- True for org-wide managers and for anyone flagged as manager of any
-- department. Used to gate "can approve / can assign" style actions.
create or replace function public.is_manager(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('super_admin', 'manager') from public.profiles where id = uid and is_active),
    false
  ) or exists (
    select 1 from public.department_members
    where user_id = uid and is_manager
  );
$$;

-- Every department the user belongs to, via membership or as their primary.
create or replace function public.my_departments(uid uuid default auth.uid())
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select department_id from public.department_members where user_id = uid
  union
  select primary_department_id from public.profiles
   where id = uid and primary_department_id is not null;
$$;

create or replace function public.manages_department(dept uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin(uid) or exists (
    select 1 from public.department_members
    where user_id = uid and department_id = dept and is_manager
  );
$$;

-- The workhorse: can this user see records belonging to this department?
-- Super admins see everything; a null department means org-wide/shared.
create or replace function public.can_see_department(dept uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select dept is null
      or public.is_super_admin(uid)
      or dept in (select public.my_departments(uid));
$$;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

alter table public.departments        enable row level security;
alter table public.profiles           enable row level security;
alter table public.department_members enable row level security;

-- Departments are org-wide reference data: everyone signed in can read them
-- (needed to render filters, assignment pickers, nav). Only super admins write.
create policy departments_read on public.departments
  for select to authenticated using (true);

create policy departments_write on public.departments
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- A team directory is only useful if the team can see each other.
create policy profiles_read on public.profiles
  for select to authenticated using (true);

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_admin_write on public.profiles
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy department_members_read on public.department_members
  for select to authenticated using (true);

-- Department managers can staff their own department; super admins, anyone.
create policy department_members_write on public.department_members
  for all to authenticated
  using (public.manages_department(department_id))
  with check (public.manages_department(department_id));

-- ---------------------------------------------------------------------------
-- Guard: only a super admin may change someone's role or active status.
-- profiles_update_self would otherwise let a member promote themselves.
-- ---------------------------------------------------------------------------

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Trusted server paths (service role, triggers) run without a JWT subject.
  if auth.uid() is null then
    return new;
  end if;

  if (new.role is distinct from old.role
      or new.is_active is distinct from old.is_active)
     and not public.is_super_admin() then
    raise exception 'Only a super admin can change role or active status';
  end if;

  return new;
end;
$$;

create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ---------------------------------------------------------------------------
-- Seed departments — the ones Nexis actually runs today.
-- ---------------------------------------------------------------------------

insert into public.departments (name, slug, description, icon, color, sort_order) values
  ('Events',                'events',      'Event planning, execution and post-event wrap-up',  'calendar-days', '#EF3A5D', 1),
  ('Marketing',             'marketing',   'Campaigns, creatives, content and the marketing calendar', 'megaphone', '#FF0049', 2),
  ('Admissions',            'admissions',  'Enquiries, counselling, applications and enrolment', 'graduation-cap', '#D5FE00', 3),
  ('Campus Infrastructure', 'campus',      'Facilities, maintenance, equipment and campus upkeep', 'building-2',  '#410f1c', 4),
  ('Finance',               'finance',     'Budgets, expense approvals, vendor payments and reimbursements', 'wallet', '#111111', 5),
  ('Academics',             'academics',   'Curriculum, faculty coordination and academic delivery', 'book-open',  '#3C3939', 6)
on conflict (slug) do nothing;
