-- ============================================================================
-- Nexis OS — 0007 meetings
--
-- Nexis runs a lot of meetings. The two things that go wrong are people not
-- knowing they were expected, and decisions evaporating the moment everyone
-- leaves the room. So: explicit invitations with an RSVP, and minutes that
-- turn into real assignable tasks rather than a note in someone's phone.
-- ============================================================================

create type meeting_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled');

create type attendee_status as enum (
  'invited', 'accepted', 'declined', 'tentative', 'attended', 'absent'
);

create table public.meetings (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  agenda        text,
  status        meeting_status not null default 'scheduled',

  starts_at     timestamptz not null,
  ends_at       timestamptz,
  location      text,
  -- Video call URL, for the half of meetings that aren't in a room.
  meeting_link  text,

  department_id uuid references public.departments(id) on delete set null,
  organiser_id  uuid references public.profiles(id) on delete set null,
  -- Meetings often hang off an event ("Open House run-through").
  event_id      uuid references public.events(id) on delete set null,

  -- Written up afterwards. Decisions are separated from the narrative so the
  -- outcome is findable without reading the whole thing.
  minutes       text,
  decisions     text,

  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index meetings_starts_at_idx  on public.meetings (starts_at desc);
create index meetings_department_idx on public.meetings (department_id);
create index meetings_organiser_idx  on public.meetings (organiser_id);
create index meetings_event_idx      on public.meetings (event_id);

create trigger meetings_touch
  before update on public.meetings
  for each row execute function public.touch_updated_at();

create table public.meeting_attendees (
  meeting_id   uuid not null references public.meetings(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  status       attendee_status not null default 'invited',
  is_organiser boolean not null default false,
  -- Whether attendance is expected or the invite is informational.
  is_optional  boolean not null default false,
  responded_at timestamptz,
  note         text,
  created_at   timestamptz not null default now(),
  primary key (meeting_id, user_id)
);

create index meeting_attendees_user_idx on public.meeting_attendees (user_id);

-- Action items are ordinary tasks, so they land in "My work", get reminders
-- and can be commented on like anything else. One task engine, as elsewhere.
alter table public.tasks
  add column meeting_id uuid references public.meetings(id) on delete cascade;

create index tasks_meeting_idx on public.tasks (meeting_id);

-- ---------------------------------------------------------------------------
-- RLS
--
-- Meetings are more private than the rest of the OS: a one-to-one about
-- someone's performance should not be readable by the whole school. Visible
-- to the people in the room, the organiser, and managers of the owning
-- department.
-- ---------------------------------------------------------------------------

alter table public.meetings          enable row level security;
alter table public.meeting_attendees enable row level security;

create or replace function public.attends_meeting(meeting uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.meeting_attendees
     where meeting_id = meeting and user_id = uid
  );
$$;

create policy meetings_read on public.meetings
  for select to authenticated
  using (
    organiser_id = auth.uid()
    or created_by = auth.uid()
    or public.attends_meeting(id)
    or public.is_super_admin()
    or public.manages_department(department_id)
  );

create policy meetings_insert on public.meetings
  for insert to authenticated
  with check (created_by = auth.uid());

create policy meetings_update on public.meetings
  for update to authenticated
  using (
    organiser_id = auth.uid()
    or created_by = auth.uid()
    or public.is_super_admin()
    or public.manages_department(department_id)
  )
  with check (
    organiser_id = auth.uid()
    or created_by = auth.uid()
    or public.is_super_admin()
    or public.manages_department(department_id)
  );

create policy meetings_delete on public.meetings
  for delete to authenticated
  using (organiser_id = auth.uid() or created_by = auth.uid() or public.is_super_admin());

-- An attendee can see the guest list of any meeting they are in.
create policy meeting_attendees_read on public.meeting_attendees
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.attends_meeting(meeting_id)
    or public.is_super_admin()
    or exists (
      select 1 from public.meetings m
       where m.id = meeting_id
         and (m.organiser_id = auth.uid() or m.created_by = auth.uid())
    )
  );

-- The organiser manages the guest list; an attendee may only change their own
-- row, which is how RSVP works without letting anyone answer for others.
create policy meeting_attendees_write on public.meeting_attendees
  for all to authenticated
  using (
    user_id = auth.uid()
    or public.is_super_admin()
    or exists (
      select 1 from public.meetings m
       where m.id = meeting_id
         and (m.organiser_id = auth.uid() or m.created_by = auth.uid())
    )
  )
  with check (
    user_id = auth.uid()
    or public.is_super_admin()
    or exists (
      select 1 from public.meetings m
       where m.id = meeting_id
         and (m.organiser_id = auth.uid() or m.created_by = auth.uid())
    )
  );
