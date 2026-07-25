-- ============================================================================
-- Nexis OS — 0003 default event playbook + storage buckets
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The standard Nexis event formula.
--
-- offset_days is relative to the event date: -21 means "due three weeks out".
-- Creating an event from this playbook materialises every line below as a real,
-- assignable, remindable task with a concrete due date.
-- ---------------------------------------------------------------------------

insert into public.event_playbooks (id, name, description, is_default)
values (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Standard Nexis Event',
  'The default end-to-end checklist for any Nexis event — from concept sign-off through post-event wrap-up.',
  true
)
on conflict (id) do nothing;

insert into public.event_playbook_items (playbook_id, category, title, description, offset_days, sort_order)
values
  -- ── Concept & budget ────────────────────────────────────────────────────
  ('00000000-0000-0000-0000-000000000001', 'budget',         'Lock event concept, objective and success metric', 'What is this event for, and how will we know it worked?', -30, 10),
  ('00000000-0000-0000-0000-000000000001', 'budget',         'Prepare and get budget approved',                   'Line-item budget: venue, F&B, printing, gifting, media.',  -28, 20),

  -- ── Venue & logistics ───────────────────────────────────────────────────
  ('00000000-0000-0000-0000-000000000001', 'venue',          'Confirm venue and block the date',                  'Written confirmation, not a verbal hold.',                 -25, 30),
  ('00000000-0000-0000-0000-000000000001', 'venue',          'Site visit and floor plan',                         'Seating, entry/exit, power points, wifi, washrooms.',      -14, 40),
  ('00000000-0000-0000-0000-000000000001', 'stage_setup',    'Finalise stage design and backdrop',                'Backdrop must follow Nexis brand — pink/ink/cream, Poppins.', -12, 50),
  ('00000000-0000-0000-0000-000000000001', 'stage_setup',    'Book AV: sound, mics, projector, lighting',         'Confirm vendor, delivery time and on-site technician.',    -12, 60),
  ('00000000-0000-0000-0000-000000000001', 'logistics',      'Arrange seating, tables and green room',            NULL,                                                       -7,  70),
  ('00000000-0000-0000-0000-000000000001', 'logistics',      'Plan transport and parking',                        'For guests, speakers and equipment.',                      -5,  80),
  ('00000000-0000-0000-0000-000000000001', 'hospitality',    'Confirm F&B / catering headcount',                  'Lock final numbers with the caterer.',                     -3,  90),
  ('00000000-0000-0000-0000-000000000001', 'hospitality',    'Arrange speaker/chief guest hospitality',           'Pickup, hotel, welcome kit, momento.',                     -5,  100),

  -- ── Printables & branding ───────────────────────────────────────────────
  ('00000000-0000-0000-0000-000000000001', 'printables',     'Design event creative set',                         'Poster, standee, backdrop, social kit — one visual language.', -18, 110),
  ('00000000-0000-0000-0000-000000000001', 'printables',     'Get creatives approved',                            'Submit to Marketing for approval inside Nexis OS.',        -16, 120),
  ('00000000-0000-0000-0000-000000000001', 'printables',     'Send printables to press',                          'Standees, banners, badges, certificates, signage.',        -10, 130),
  ('00000000-0000-0000-0000-000000000001', 'printables',     'Collect and quality-check printed material',        'Check colour accuracy against brand pink #EF3A5D.',        -4,  140),

  -- ── Invitations & registrations ─────────────────────────────────────────
  ('00000000-0000-0000-0000-000000000001', 'invitations',    'Build the invitee list',                            'Students, parents, faculty, industry guests, media.',      -20, 150),
  ('00000000-0000-0000-0000-000000000001', 'invitations',    'Design and approve the invitation',                 NULL,                                                      -17, 160),
  ('00000000-0000-0000-0000-000000000001', 'invitations',    'Send invitations',                                  'WhatsApp + email. Track who has opened and replied.',      -14, 170),
  ('00000000-0000-0000-0000-000000000001', 'registrations',  'Open the registration form',                        'Turn on registrations in Nexis OS and share the link.',    -14, 180),
  ('00000000-0000-0000-0000-000000000001', 'invitations',    'Follow up with non-responders',                     'The follow-up is where most events are won or lost.',      -7,  190),
  ('00000000-0000-0000-0000-000000000001', 'registrations',  'Send reminder to all registrants',                  'Automated WhatsApp reminder, 24 hours before.',           -1,  200),

  -- ── Announcements & marketing ───────────────────────────────────────────
  ('00000000-0000-0000-0000-000000000001', 'marketing',      'Write the marketing plan for this event',           'Channels, budget, posting cadence, target reach.',        -21, 210),
  ('00000000-0000-0000-0000-000000000001', 'announcements',  'Draft announcement script and get it approved',     'Every outgoing script needs approval before it goes out.', -15, 220),
  ('00000000-0000-0000-0000-000000000001', 'announcements',  'Publish announcement post',                         'Instagram, LinkedIn, WhatsApp status, website.',          -13, 230),
  ('00000000-0000-0000-0000-000000000001', 'campaigns',      'Launch paid campaign',                              'Meta / Google. Set budget cap and audience.',             -12, 240),
  ('00000000-0000-0000-0000-000000000001', 'campaigns',      'Mid-campaign performance check',                    'Reach, CTR, registrations. Adjust spend if needed.',       -6,  250),
  ('00000000-0000-0000-0000-000000000001', 'announcements',  'Publish final reminder post',                       'Last-call creative, 24-48 hours out.',                    -2,  260),

  -- ── Run of show ─────────────────────────────────────────────────────────
  ('00000000-0000-0000-0000-000000000001', 'documentation',  'Prepare run-of-show / minute-by-minute schedule',   'Who is on stage when, and who is cueing them.',            -5,  270),
  ('00000000-0000-0000-0000-000000000001', 'documentation',  'Assign on-ground roles to the team',                'Registration desk, stage manager, media, guest handling.', -4,  280),
  ('00000000-0000-0000-0000-000000000001', 'documentation',  'Brief the anchor and share the script',             NULL,                                                      -3,  290),
  ('00000000-0000-0000-0000-000000000001', 'logistics',      'Full dry run and rehearsal',                        'Test AV, run through the stage flow end to end.',          -1,  300),
  ('00000000-0000-0000-0000-000000000001', 'documentation',  'Confirm photographer and videographer',             'Share the shot list and key moments to capture.',          -7,  310),

  -- ── Event day ───────────────────────────────────────────────────────────
  ('00000000-0000-0000-0000-000000000001', 'logistics',      'Venue setup and final check',                       'Be on site early. Walk the full guest journey.',            0,  320),
  ('00000000-0000-0000-0000-000000000001', 'registrations',  'Run the registration desk and mark attendance',     NULL,                                                        0,  330),
  ('00000000-0000-0000-0000-000000000001', 'documentation',  'Capture photos, video and testimonials',           'Content for the post-event campaign starts here.',           0,  340),

  -- ── Wrap-up ─────────────────────────────────────────────────────────────
  ('00000000-0000-0000-0000-000000000001', 'documentation',  'Send thank-you messages',                           'Guests, speakers, vendors, and the team.',                  1,  350),
  ('00000000-0000-0000-0000-000000000001', 'marketing',      'Publish post-event recap content',                  'Reel, carousel and press note while it is still fresh.',     3,  360),
  ('00000000-0000-0000-0000-000000000001', 'budget',         'Settle vendor payments and close the budget',       'Reconcile actual spend against the approved budget.',        7,  370),
  ('00000000-0000-0000-0000-000000000001', 'documentation',  'Write the post-event review',                       'What worked, what did not, what changes next time.',         7,  380)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Storage buckets
--
-- All private. The app serves files through signed URLs so that access follows
-- the same rules as the rest of the OS rather than being world-readable.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('creatives', 'creatives', false, 52428800,
   array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml',
         'video/mp4','video/quicktime','application/pdf']),
  ('event-assets', 'event-assets', false, 52428800,
   array['image/png','image/jpeg','image/webp','application/pdf']),
  ('avatars', 'avatars', false, 5242880,
   array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

-- Any signed-in staff member can read and upload; only the uploader or a super
-- admin can overwrite or delete.
create policy "nexis staff read objects"
  on storage.objects for select to authenticated
  using (bucket_id in ('creatives', 'event-assets', 'avatars'));

create policy "nexis staff upload objects"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('creatives', 'event-assets', 'avatars'));

create policy "nexis owner updates objects"
  on storage.objects for update to authenticated
  using (bucket_id in ('creatives', 'event-assets', 'avatars')
         and (owner = auth.uid() or public.is_super_admin()));

create policy "nexis owner deletes objects"
  on storage.objects for delete to authenticated
  using (bucket_id in ('creatives', 'event-assets', 'avatars')
         and (owner = auth.uid() or public.is_super_admin()));
