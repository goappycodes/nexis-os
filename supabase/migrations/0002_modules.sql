-- ============================================================================
-- Nexis OS — 0002 modules
-- Events, marketing, the unified task engine, approvals, reminders.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type event_status    as enum ('draft', 'planning', 'ready', 'live', 'completed', 'cancelled');
create type task_status     as enum ('todo', 'in_progress', 'blocked', 'done', 'cancelled');
create type task_priority   as enum ('low', 'normal', 'high', 'urgent');
create type approval_status as enum ('draft', 'pending', 'approved', 'changes_requested', 'rejected');
create type campaign_status as enum ('planned', 'in_progress', 'live', 'completed', 'cancelled');
create type creative_type   as enum ('image', 'video', 'reel', 'carousel', 'story', 'poster', 'banner', 'brochure', 'other');
create type script_type     as enum ('reel', 'ad', 'announcement', 'call', 'email', 'whatsapp', 'speech', 'other');
create type reminder_channel as enum ('whatsapp', 'sms', 'email', 'in_app');
create type reminder_status  as enum ('pending', 'sent', 'failed', 'cancelled');

-- The repeatable parts of running a Nexis event. Playbook items and tasks both
-- carry one, so a checklist can be grouped the way the team actually thinks.
create type work_category as enum (
  'printables', 'venue', 'stage_setup', 'logistics', 'invitations',
  'announcements', 'marketing', 'campaigns', 'budget', 'registrations',
  'hospitality', 'documentation', 'other'
);

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

create table public.events (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  slug                  text not null unique,
  description           text,
  department_id         uuid references public.departments(id) on delete set null,
  owner_id              uuid references public.profiles(id) on delete set null,
  status                event_status not null default 'draft',
  starts_at             timestamptz not null,
  ends_at               timestamptz,
  venue                 text,
  expected_attendees    int,
  budget_amount         numeric(12, 2),
  cover_image_path      text,
  registration_enabled  boolean not null default false,
  registration_deadline timestamptz,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index events_starts_at_idx  on public.events (starts_at desc);
create index events_department_idx on public.events (department_id);
create index events_status_idx     on public.events (status);

-- A playbook is the "preset formula" — the standard set of work that every
-- event of a given kind needs, so nothing is reinvented or forgotten.
create table public.event_playbooks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  is_default  boolean not null default false,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.event_playbook_items (
  id            uuid primary key default gen_random_uuid(),
  playbook_id   uuid not null references public.event_playbooks(id) on delete cascade,
  category      work_category not null default 'other',
  title         text not null,
  description   text,
  -- Days relative to the event date; negative means "before". -14 = two weeks out.
  offset_days   int not null default -7,
  department_id uuid references public.departments(id) on delete set null,
  sort_order    int not null default 0
);

create index event_playbook_items_playbook_idx on public.event_playbook_items (playbook_id, sort_order);

-- ---------------------------------------------------------------------------
-- Boards (ad-hoc Trello-style work)
-- ---------------------------------------------------------------------------

create table public.boards (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  department_id uuid references public.departments(id) on delete set null,
  created_by    uuid references public.profiles(id) on delete set null,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create table public.board_columns (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.boards(id) on delete cascade,
  name       text not null,
  sort_order int not null default 0
);

create index board_columns_board_idx on public.board_columns (board_id, sort_order);

-- ---------------------------------------------------------------------------
-- Tasks — one engine for everything
--
-- Deliberately unified: an event checklist item, a marketing to-do and an
-- ad-hoc card are all rows here. That means one assignment model, one reminder
-- pipeline and one "my work" query, instead of three parallel systems.
-- ---------------------------------------------------------------------------

create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  department_id uuid references public.departments(id) on delete set null,
  assignee_id   uuid references public.profiles(id) on delete set null,
  created_by    uuid references public.profiles(id) on delete set null,

  -- Context: at most one of these is set in practice, none for a loose task.
  board_id      uuid references public.boards(id) on delete cascade,
  column_id     uuid references public.board_columns(id) on delete set null,
  event_id      uuid references public.events(id) on delete cascade,
  campaign_id   uuid,  -- FK added after marketing_campaigns exists

  category      work_category not null default 'other',
  status        task_status   not null default 'todo',
  priority      task_priority not null default 'normal',
  due_at        timestamptz,
  completed_at  timestamptz,
  completed_by  uuid references public.profiles(id) on delete set null,
  labels        text[] not null default '{}',
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index tasks_assignee_idx   on public.tasks (assignee_id, status);
create index tasks_event_idx      on public.tasks (event_id);
create index tasks_board_idx      on public.tasks (board_id, column_id, sort_order);
create index tasks_due_idx        on public.tasks (due_at) where status not in ('done', 'cancelled');
create index tasks_department_idx on public.tasks (department_id);

create table public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);

create index task_comments_task_idx on public.task_comments (task_id, created_at);

create table public.task_checklist_items (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  title      text not null,
  is_done    boolean not null default false,
  sort_order int not null default 0
);

-- ---------------------------------------------------------------------------
-- Marketing
-- ---------------------------------------------------------------------------

create table public.marketing_campaigns (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  -- Always stored as the first of the month; this is what the calendar groups by.
  month         date not null,
  objective     text,
  channels      text[] not null default '{}',
  status        campaign_status not null default 'planned',
  department_id uuid references public.departments(id) on delete set null,
  owner_id      uuid references public.profiles(id) on delete set null,
  event_id      uuid references public.events(id) on delete set null,
  starts_on     date,
  ends_on       date,
  budget_amount numeric(12, 2),
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index marketing_campaigns_month_idx on public.marketing_campaigns (month desc);

alter table public.tasks
  add constraint tasks_campaign_fk
  foreign key (campaign_id) references public.marketing_campaigns(id) on delete cascade;

-- Creatives and scripts are the two things that today bounce around WhatsApp
-- waiting for a yes. Both carry an approval_status and a version number so a
-- re-upload after "changes requested" is tracked rather than overwritten.
create table public.creatives (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  type           creative_type not null default 'image',
  channel        text,
  caption        text,
  file_path      text,
  thumbnail_path text,
  version        int not null default 1,
  status         approval_status not null default 'draft',
  campaign_id    uuid references public.marketing_campaigns(id) on delete set null,
  event_id       uuid references public.events(id) on delete set null,
  department_id  uuid references public.departments(id) on delete set null,
  scheduled_for  timestamptz,
  published_at   timestamptz,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index creatives_status_idx   on public.creatives (status);
create index creatives_campaign_idx on public.creatives (campaign_id);

create table public.scripts (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  type          script_type not null default 'other',
  body          text not null default '',
  version       int not null default 1,
  status        approval_status not null default 'draft',
  campaign_id   uuid references public.marketing_campaigns(id) on delete set null,
  event_id      uuid references public.events(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index scripts_status_idx on public.scripts (status);

-- ---------------------------------------------------------------------------
-- Approvals — one review pipeline for any entity
-- ---------------------------------------------------------------------------

create table public.approval_requests (
  id            uuid primary key default gen_random_uuid(),
  entity_type   text not null check (entity_type in ('creative', 'script', 'campaign', 'event', 'expense', 'task')),
  entity_id     uuid not null,
  title         text not null default '',
  department_id uuid references public.departments(id) on delete set null,
  requested_by  uuid references public.profiles(id) on delete set null,
  assigned_to   uuid references public.profiles(id) on delete set null,
  status        approval_status not null default 'pending',
  version       int not null default 1,
  note          text,
  due_at        timestamptz,
  decided_by    uuid references public.profiles(id) on delete set null,
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index approval_requests_entity_idx   on public.approval_requests (entity_type, entity_id);
create index approval_requests_assignee_idx on public.approval_requests (assigned_to, status);
create index approval_requests_status_idx   on public.approval_requests (status);

create table public.approval_comments (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.approval_requests(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  body        text not null,
  -- Set when the comment accompanies a decision, so the history reads as a
  -- narrative rather than a pile of disconnected notes.
  decision    approval_status,
  created_at  timestamptz not null default now()
);

create index approval_comments_request_idx on public.approval_comments (request_id, created_at);

-- ---------------------------------------------------------------------------
-- Event registrations
-- ---------------------------------------------------------------------------

create table public.event_registrations (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  full_name  text not null,
  email      text,
  phone      text,
  -- Whatever extra questions that event's form asked.
  extra      jsonb not null default '{}'::jsonb,
  status     text not null default 'registered'
             check (status in ('registered', 'waitlist', 'cancelled', 'attended', 'no_show')),
  source     text,
  created_at timestamptz not null default now()
);

create index event_registrations_event_idx on public.event_registrations (event_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Notifications, reminders, message log
-- ---------------------------------------------------------------------------

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  body        text,
  url         text,
  entity_type text,
  entity_id   uuid,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- A row here is "send this message to this person at this time". The cron
-- endpoint drains anything pending whose send_at has passed.
create table public.reminders (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.profiles(id) on delete cascade,
  entity_type         text,
  entity_id           uuid,
  channel             reminder_channel not null default 'whatsapp',
  send_at             timestamptz not null,
  template            text,
  payload             jsonb not null default '{}'::jsonb,
  body                text,
  status              reminder_status not null default 'pending',
  attempts            int not null default 0,
  sent_at             timestamptz,
  error               text,
  provider_message_id text,
  created_at          timestamptz not null default now()
);

create index reminders_due_idx on public.reminders (send_at) where status = 'pending';

-- Append-only record of everything the messaging provider was asked to do.
create table public.message_log (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null default 'msg91',
  channel           reminder_channel not null,
  recipient         text not null,
  template          text,
  body              text,
  status            text not null,
  provider_response jsonb,
  reminder_id       uuid references public.reminders(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index message_log_created_idx on public.message_log (created_at desc);

create table public.activity_log (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid references public.profiles(id) on delete set null,
  action        text not null,
  entity_type   text,
  entity_id     uuid,
  department_id uuid references public.departments(id) on delete set null,
  summary       text,
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index activity_log_created_idx on public.activity_log (created_at desc);
create index activity_log_entity_idx  on public.activity_log (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger events_touch    before update on public.events              for each row execute function public.touch_updated_at();
create trigger tasks_touch     before update on public.tasks               for each row execute function public.touch_updated_at();
create trigger campaigns_touch before update on public.marketing_campaigns for each row execute function public.touch_updated_at();
create trigger creatives_touch before update on public.creatives           for each row execute function public.touch_updated_at();
create trigger scripts_touch   before update on public.scripts             for each row execute function public.touch_updated_at();

-- Stamp completion metadata centrally so no caller can forget it.
create or replace function public.stamp_task_completion()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at = now();
    new.completed_by = coalesce(auth.uid(), new.completed_by);
  elsif new.status <> 'done' then
    new.completed_at = null;
    new.completed_by = null;
  end if;
  return new;
end;
$$;

create trigger tasks_stamp_completion
  before update on public.tasks
  for each row execute function public.stamp_task_completion();

-- ---------------------------------------------------------------------------
-- RLS
--
-- Shape of the model: reading is broad (an internal OS is useless if people
-- can't see the work around them), writing is scoped to the people responsible.
-- ---------------------------------------------------------------------------

alter table public.events               enable row level security;
alter table public.event_playbooks      enable row level security;
alter table public.event_playbook_items enable row level security;
alter table public.boards               enable row level security;
alter table public.board_columns        enable row level security;
alter table public.tasks                enable row level security;
alter table public.task_comments        enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.marketing_campaigns  enable row level security;
alter table public.creatives            enable row level security;
alter table public.scripts              enable row level security;
alter table public.approval_requests    enable row level security;
alter table public.approval_comments    enable row level security;
alter table public.event_registrations  enable row level security;
alter table public.notifications        enable row level security;
alter table public.reminders            enable row level security;
alter table public.message_log          enable row level security;
alter table public.activity_log         enable row level security;

-- Read-for-all-staff tables.
create policy events_read      on public.events              for select to authenticated using (true);
create policy playbooks_read   on public.event_playbooks     for select to authenticated using (true);
create policy playbook_items_read on public.event_playbook_items for select to authenticated using (true);
create policy boards_read      on public.boards              for select to authenticated using (true);
create policy columns_read     on public.board_columns       for select to authenticated using (true);
create policy tasks_read       on public.tasks               for select to authenticated using (true);
create policy task_comments_read on public.task_comments     for select to authenticated using (true);
create policy checklist_read   on public.task_checklist_items for select to authenticated using (true);
create policy campaigns_read   on public.marketing_campaigns for select to authenticated using (true);
create policy creatives_read   on public.creatives           for select to authenticated using (true);
create policy scripts_read     on public.scripts             for select to authenticated using (true);
create policy approvals_read   on public.approval_requests   for select to authenticated using (true);
create policy approval_comments_read on public.approval_comments for select to authenticated using (true);
create policy activity_read    on public.activity_log        for select to authenticated using (true);

-- Events: the owner, the department's manager, or a super admin.
create policy events_write on public.events
  for all to authenticated
  using (public.is_super_admin() or owner_id = auth.uid() or created_by = auth.uid()
         or public.manages_department(department_id))
  with check (public.is_super_admin() or owner_id = auth.uid() or created_by = auth.uid()
              or public.manages_department(department_id));

create policy playbooks_write on public.event_playbooks
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

create policy playbook_items_write on public.event_playbook_items
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

create policy boards_write on public.boards
  for all to authenticated
  using (public.is_super_admin() or created_by = auth.uid() or public.manages_department(department_id))
  with check (public.is_super_admin() or created_by = auth.uid() or public.manages_department(department_id));

create policy columns_write on public.board_columns
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- Tasks: your own work, work you created, or anything in a department you manage.
-- Members can update the tasks assigned to them (that is the whole point) but
-- cannot reassign work across the org.
create policy tasks_write on public.tasks
  for all to authenticated
  using (public.is_super_admin() or assignee_id = auth.uid() or created_by = auth.uid()
         or public.manages_department(department_id))
  with check (public.is_super_admin() or assignee_id = auth.uid() or created_by = auth.uid()
              or public.manages_department(department_id));

create policy task_comments_write on public.task_comments
  for all to authenticated
  using (author_id = auth.uid() or public.is_super_admin())
  with check (author_id = auth.uid() or public.is_super_admin());

create policy checklist_write on public.task_checklist_items
  for all to authenticated using (true) with check (true);

create policy campaigns_write on public.marketing_campaigns
  for all to authenticated
  using (public.is_super_admin() or owner_id = auth.uid() or created_by = auth.uid()
         or public.manages_department(department_id))
  with check (public.is_super_admin() or owner_id = auth.uid() or created_by = auth.uid()
              or public.manages_department(department_id));

-- Anyone on staff can submit a creative or script for approval; the approval
-- record itself is what gates whether it goes live.
create policy creatives_write on public.creatives
  for all to authenticated
  using (public.is_super_admin() or created_by = auth.uid() or public.manages_department(department_id))
  with check (public.is_super_admin() or created_by = auth.uid() or public.manages_department(department_id));

create policy scripts_write on public.scripts
  for all to authenticated
  using (public.is_super_admin() or created_by = auth.uid() or public.manages_department(department_id))
  with check (public.is_super_admin() or created_by = auth.uid() or public.manages_department(department_id));

create policy approvals_insert on public.approval_requests
  for insert to authenticated with check (requested_by = auth.uid() or public.is_manager());

-- Only the assigned reviewer, a department manager or a super admin may decide.
create policy approvals_decide on public.approval_requests
  for update to authenticated
  using (public.is_super_admin() or assigned_to = auth.uid() or public.manages_department(department_id))
  with check (public.is_super_admin() or assigned_to = auth.uid() or public.manages_department(department_id));

create policy approvals_delete on public.approval_requests
  for delete to authenticated
  using (public.is_super_admin() or requested_by = auth.uid());

create policy approval_comments_write on public.approval_comments
  for all to authenticated
  using (author_id = auth.uid() or public.is_super_admin())
  with check (author_id = auth.uid() or public.is_super_admin());

-- Registrations hold attendee PII, so they are manager-only.
create policy registrations_read on public.event_registrations
  for select to authenticated using (public.is_manager());

create policy registrations_write on public.event_registrations
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- Notifications and reminders are strictly personal.
create policy notifications_own on public.notifications
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy reminders_own on public.reminders
  for select to authenticated using (user_id = auth.uid() or public.is_manager());

create policy reminders_write on public.reminders
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- Delivery logs are an audit surface: super admin only.
create policy message_log_admin on public.message_log
  for select to authenticated using (public.is_super_admin());

create policy activity_insert on public.activity_log
  for insert to authenticated with check (actor_id = auth.uid() or actor_id is null);
