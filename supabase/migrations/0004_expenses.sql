-- ============================================================================
-- Nexis OS — 0004 expenses and finance requests
-- ============================================================================

create type expense_status as enum (
  'draft', 'pending', 'approved', 'changes_requested', 'rejected', 'paid'
);

create type expense_category as enum (
  'travel', 'vendor', 'equipment', 'food', 'marketing', 'printing',
  'maintenance', 'salary', 'utilities', 'event', 'other'
);

-- ---------------------------------------------------------------------------
-- Expenses
--
-- Covers both reimbursements (someone spent their own money) and payment
-- requests (a vendor needs paying). `is_reimbursement` is what tells Finance
-- who the money goes to.
-- ---------------------------------------------------------------------------

create table public.expenses (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text,
  amount           numeric(12, 2) not null check (amount > 0),
  category         expense_category not null default 'other',
  status           expense_status not null default 'draft',

  vendor           text,
  expense_date     date not null default current_date,
  is_reimbursement boolean not null default true,

  -- Where the money is charged, and what it belongs to.
  department_id    uuid references public.departments(id) on delete set null,
  event_id         uuid references public.events(id) on delete set null,
  campaign_id      uuid references public.marketing_campaigns(id) on delete set null,

  requested_by     uuid references public.profiles(id) on delete set null,
  approver_id      uuid references public.profiles(id) on delete set null,
  approved_by      uuid references public.profiles(id) on delete set null,
  approved_at      timestamptz,

  -- Settlement, filled in by Finance once the money actually moves.
  paid_at          timestamptz,
  paid_by          uuid references public.profiles(id) on delete set null,
  payment_method   text,
  payment_ref      text,

  receipt_path     text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index expenses_status_idx     on public.expenses (status);
create index expenses_requester_idx  on public.expenses (requested_by, status);
create index expenses_department_idx on public.expenses (department_id);
create index expenses_date_idx       on public.expenses (expense_date desc);
create index expenses_event_idx      on public.expenses (event_id);

create trigger expenses_touch
  before update on public.expenses
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
--
-- Money is more sensitive than the rest of the OS: a member sees only their
-- own claims. Managers see their department's, Finance and super admins see
-- everything.
-- ---------------------------------------------------------------------------

alter table public.expenses enable row level security;

-- True for org-wide managers, super admins, and anyone who manages the
-- Finance department — Finance needs sight of every claim to settle it.
create or replace function public.is_finance(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('super_admin', 'manager') from public.profiles
      where id = uid and is_active),
    false
  ) or exists (
    select 1
      from public.department_members dm
      join public.departments d on d.id = dm.department_id
     where dm.user_id = uid and dm.is_manager and d.slug = 'finance'
  );
$$;

create policy expenses_read on public.expenses
  for select to authenticated
  using (
    requested_by = auth.uid()
    or approver_id = auth.uid()
    or public.is_finance()
    or public.manages_department(department_id)
  );

-- Anyone on staff can raise a claim, but only for themselves.
create policy expenses_insert on public.expenses
  for insert to authenticated
  with check (requested_by = auth.uid());

-- The requester may edit while it is still theirs to edit; approvers and
-- Finance may act on it at any point.
create policy expenses_update on public.expenses
  for update to authenticated
  using (
    (requested_by = auth.uid() and status in ('draft', 'changes_requested'))
    or approver_id = auth.uid()
    or public.is_finance()
    or public.manages_department(department_id)
  )
  with check (
    (requested_by = auth.uid() and status in ('draft', 'pending', 'changes_requested'))
    or approver_id = auth.uid()
    or public.is_finance()
    or public.manages_department(department_id)
  );

create policy expenses_delete on public.expenses
  for delete to authenticated
  using (
    (requested_by = auth.uid() and status = 'draft')
    or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- Receipts bucket. Private — receipts carry bank and personal detail.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts', 'receipts', false, 10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

create policy "nexis staff read receipts"
  on storage.objects for select to authenticated
  using (bucket_id = 'receipts');

create policy "nexis staff upload receipts"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts');

create policy "nexis owner manages receipts"
  on storage.objects for update to authenticated
  using (bucket_id = 'receipts' and (owner = auth.uid() or public.is_super_admin()));

create policy "nexis owner deletes receipts"
  on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (owner = auth.uid() or public.is_super_admin()));
