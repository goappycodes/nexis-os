-- ============================================================================
-- Nexis OS — 0006 brand kit and asset library
--
-- The point of this module: there should be exactly one place to find the
-- right logo, the right pink and the approved brochure. Every department
-- drifting onto its own colours and its own poster template is the problem
-- this table exists to end.
-- ============================================================================

create type brand_token_kind as enum ('color', 'font', 'rule');

create type brand_asset_category as enum (
  'logo', 'template', 'photo', 'document', 'presentation',
  'video', 'icon', 'font', 'other'
);

-- ---------------------------------------------------------------------------
-- Brand tokens — the canonical colours, type and written rules.
-- Stored rather than hard-coded so a super admin can correct them without a
-- deploy, which is the only way they stay true over time.
-- ---------------------------------------------------------------------------

create table public.brand_tokens (
  id          uuid primary key default gen_random_uuid(),
  kind        brand_token_kind not null,
  name        text not null,
  -- Hex for a colour, family/weights for a font, empty for a written rule.
  value       text not null default '',
  description text,
  -- When to reach for this one, and when not to.
  usage_note  text,
  is_primary  boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index brand_tokens_kind_idx on public.brand_tokens (kind, sort_order);

create trigger brand_tokens_touch
  before update on public.brand_tokens
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Assets
-- ---------------------------------------------------------------------------

create table public.brand_assets (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text,
  category       brand_asset_category not null default 'other',
  file_path      text not null,
  thumbnail_path text,
  file_size      bigint,
  mime_type      text,
  tags           text[] not null default '{}',
  department_id  uuid references public.departments(id) on delete set null,
  -- Pinned assets surface first: the handful of things most people need most.
  is_pinned      boolean not null default false,
  download_count int not null default 0,
  uploaded_by    uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index brand_assets_category_idx on public.brand_assets (category, created_at desc);
create index brand_assets_pinned_idx   on public.brand_assets (is_pinned) where is_pinned;
create index brand_assets_tags_idx     on public.brand_assets using gin (tags);

create trigger brand_assets_touch
  before update on public.brand_assets
  for each row execute function public.touch_updated_at();

-- Counter bump for downloads. SECURITY DEFINER so a member can record a
-- download without being granted general update rights on the row.
create or replace function public.record_asset_download(asset_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.brand_assets
     set download_count = download_count + 1
   where id = asset_id;
$$;

revoke all on function public.record_asset_download(uuid) from public, anon;
grant execute on function public.record_asset_download(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS — everyone reads (that is the whole point), managers curate.
-- ---------------------------------------------------------------------------

alter table public.brand_tokens enable row level security;
alter table public.brand_assets enable row level security;

create policy brand_tokens_read on public.brand_tokens
  for select to authenticated using (true);

create policy brand_tokens_write on public.brand_tokens
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy brand_assets_read on public.brand_assets
  for select to authenticated using (true);

-- Anyone on staff can contribute an asset; only the uploader or a manager can
-- change or remove one, so the library cannot be quietly gutted.
create policy brand_assets_insert on public.brand_assets
  for insert to authenticated with check (uploaded_by = auth.uid());

create policy brand_assets_update on public.brand_assets
  for update to authenticated
  using (uploaded_by = auth.uid() or public.is_manager())
  with check (uploaded_by = auth.uid() or public.is_manager());

create policy brand_assets_delete on public.brand_assets
  for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand', 'brand', false, 104857600,
  array['image/png','image/jpeg','image/webp','image/svg+xml','image/gif',
        'application/pdf','video/mp4',
        'font/woff','font/woff2','font/ttf','application/font-woff',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/zip']
)
on conflict (id) do nothing;

create policy "nexis staff read brand"
  on storage.objects for select to authenticated
  using (bucket_id = 'brand');

create policy "nexis staff upload brand"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'brand');

create policy "nexis manages brand objects"
  on storage.objects for update to authenticated
  using (bucket_id = 'brand' and (owner = auth.uid() or public.is_manager()));

create policy "nexis deletes brand objects"
  on storage.objects for delete to authenticated
  using (bucket_id = 'brand' and (owner = auth.uid() or public.is_super_admin()));

-- ---------------------------------------------------------------------------
-- Seed the real Nexis brand, lifted from the live nexisschool.com design system
-- ---------------------------------------------------------------------------

insert into public.brand_tokens (kind, name, value, description, usage_note, is_primary, sort_order) values
  ('color', 'Nexis Pink',    '#EF3A5D', 'The primary brand colour.',            'Buttons, links, highlights and the accent word in a headline. This is the one people get wrong — it is #EF3A5D, not a generic red or magenta.', true,  10),
  ('color', 'Vivid Pink',    '#FF0049', 'Brighter pink for gradients.',          'Gradients and hover states only. Never as a flat background for body text.', false, 20),
  ('color', 'Deep Maroon',   '#410F1C', 'Dark end of the pink gradient.',        'Gradient starts and dark section backgrounds.', false, 30),
  ('color', 'Ink',           '#111111', 'Primary text and dark surfaces.',       'Body copy, headings and dark backdrops. Not pure black.', true,  40),
  ('color', 'Cream',         '#F7F0E7', 'Warm secondary surface.',               'Alternating sections and print backgrounds where white feels cold.', true,  50),
  ('color', 'Lemon',         '#D5FE00', 'High-energy accent.',                   'Sparingly — one element per layout. It shouts, so let it shout alone.', false, 60),
  ('color', 'Body Text',     '#3C3939', 'Softer text on light surfaces.',        'Long-form paragraphs where full ink is too heavy.', false, 70),
  ('color', 'Muted Grey',    '#777777', 'Secondary and caption text.',           'Captions, metadata and helper text.', false, 80),

  ('font', 'Poppins',        '400, 500, 600, 700', 'The Nexis typeface.',        'Everything. Headings at 600-700, body at 400. Do not substitute Montserrat or Poppins-alikes — the difference is visible side by side.', true, 10),

  ('rule', 'Logo clear space', '', 'Keep clear space around the logo equal to the height of the N.', 'Nothing intrudes into that margin — no text, no photo edge, no other logo.', false, 10),
  ('rule', 'Logo colour',      '', 'Dark logo on light backgrounds, white logo on dark or photographic backgrounds.', 'Never recolour the logo pink, never add a drop shadow, never stretch it.', false, 20),
  ('rule', 'Buttons',          '', 'Pill shaped, uppercase, 600 weight, generous padding.', 'Pink fill for the primary action, outline for secondary. One primary action per screen.', false, 30),
  ('rule', 'Voice',            '', 'Direct, second person, short declarative sentences.', E'"Learn by doing. Work from day 1." Not "Our institution endeavours to provide...". Write how you would say it to a student in front of you.', false, 40),
  ('rule', 'Photography',      '', 'Real students, real campus, natural light.', 'No stock photos of models in suits shaking hands. If it could be any college, it is wrong.', false, 50)
on conflict do nothing;
