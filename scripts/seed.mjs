/**
 * Seed Nexis OS with a realistic working dataset.
 *
 *   node scripts/seed.mjs          create/refresh demo data
 *   node scripts/seed.mjs --reset  wipe demo data first, then reseed
 *
 * Everything created here is tagged so --reset can remove it without touching
 * anything real: demo users all live on the @nexisschool.com domain listed
 * below, and every seeded row hangs off those users or the demo events.
 *
 * Uses the service-role key, so it bypasses RLS the way a trusted admin script
 * should. Never expose this path to the app.
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
dotenv.config({ path: join(root, ".env.local") });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const REF = process.env.SUPABASE_PROJECT_REF;

if (!URL || !SERVICE_KEY || !DB_PASSWORD || !REF) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

const RESET = process.argv.includes("--reset");

/* ── Deterministic pseudo-randomness ───────────────────────────────────────
   Seeded so repeated runs produce the same dataset — a demo that reshuffles
   every run is impossible to talk about with the team. */
let _seed = 20260725;
function rand() {
  _seed = (_seed * 1664525 + 1013904223) % 4294967296;
  return _seed / 4294967296;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const pickN = (arr, n) => [...arr].sort(() => rand() - 0.5).slice(0, n);
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const chance = (p) => rand() < p;

const day = 86_400_000;
const now = new Date();
const daysFromNow = (d, hour = 10) => {
  const date = new Date(now.getTime() + d * day);
  date.setHours(hour, 0, 0, 0);
  return date;
};

/* ── The team ─────────────────────────────────────────────────────────────
   Names and roles modelled on how a school this size actually staffs up. */
const PEOPLE = [
  { name: "Ananya Sharma",    email: "ananya.sharma@nexisschool.com",  role: "manager", dept: "marketing",  title: "Marketing Manager",        phone: "919800100011" },
  { name: "Rohan Pradhan",    email: "rohan.pradhan@nexisschool.com",  role: "member",  dept: "marketing",  title: "Content Lead",             phone: "919800100012" },
  { name: "Ishita Roy",       email: "ishita.roy@nexisschool.com",     role: "member",  dept: "marketing",  title: "Graphic Designer",         phone: "919800100013" },
  { name: "Karan Thapa",      email: "karan.thapa@nexisschool.com",    role: "member",  dept: "marketing",  title: "Social Media Executive",   phone: "919800100014" },

  { name: "Priya Agarwal",    email: "priya.agarwal@nexisschool.com",  role: "manager", dept: "events",     title: "Events Manager",           phone: "919800100021" },
  { name: "Debjit Sarkar",    email: "debjit.sarkar@nexisschool.com",  role: "member",  dept: "events",     title: "Events Coordinator",       phone: "919800100022" },
  { name: "Nisha Gurung",     email: "nisha.gurung@nexisschool.com",   role: "member",  dept: "events",     title: "Logistics Executive",      phone: "919800100023" },

  { name: "Vikram Singh",     email: "vikram.singh@nexisschool.com",   role: "manager", dept: "admissions", title: "Head of Admissions",       phone: "919800100031" },
  { name: "Meera Chettri",    email: "meera.chettri@nexisschool.com",  role: "member",  dept: "admissions", title: "Admissions Counsellor",    phone: "919800100032" },

  { name: "Sanjay Rai",       email: "sanjay.rai@nexisschool.com",     role: "manager", dept: "finance",    title: "Finance Manager",          phone: "919800100041" },
  { name: "Deepak Gupta",     email: "deepak.gupta@nexisschool.com",   role: "member",  dept: "campus",     title: "Facilities Supervisor",    phone: "919800100051" },
  { name: "Ritika Bose",      email: "ritika.bose@nexisschool.com",    role: "member",  dept: "academics",  title: "Academic Coordinator",     phone: "919800100061" },
];

/* ── Events ───────────────────────────────────────────────────────────────
   A spread of past, imminent and future so every list has something in it. */
const EVENTS = [
  { name: "Nexis Open House 2026",        offset:  49, dept: "events",     venue: "Apex Hall, Nexis Campus",              attendees: 250, budget: 150000, status: "planning",  desc: "Campus open house for prospective students and parents." },
  { name: "Pitch Tank Season 3",          offset:  21, dept: "events",     venue: "Legacy Hall, Nexis Campus",            attendees: 180, budget: 90000,  status: "planning",  desc: "Student startup pitch competition judged by industry founders." },
  { name: "NexConnect Industry Meet",     offset:   9, dept: "events",     venue: "Mayfair Tea Resort, Siliguri",         attendees: 120, budget: 220000, status: "ready",     desc: "Networking evening with hiring partners and CXO mentors." },
  { name: "Parents Orientation — Batch 6",offset:   4, dept: "academics",  venue: "Apex Hall, Nexis Campus",              attendees: 200, budget: 60000,  status: "ready",     desc: "Orientation and academic briefing for incoming batch parents." },
  { name: "18 Under 18 Awards",           offset:  75, dept: "marketing",  venue: "Sikkim Manipal Auditorium",            attendees: 400, budget: 350000, status: "draft",     desc: "Annual awards recognising young achievers across North Bengal." },
  { name: "Voice of Nexis 2026",          offset: -18, dept: "events",     venue: "Legacy Hall, Nexis Campus",            attendees: 150, budget: 75000,  status: "completed", desc: "Inter-batch cultural and music competition." },
  { name: "Round 4 Admissions Drive",     offset: -35, dept: "admissions", venue: "Tradium Building, Check Post",         attendees: 90,  budget: 45000,  status: "completed", desc: "Walk-in counselling drive for the final admissions round." },
  { name: "BizNex Case Challenge",        offset: -62, dept: "academics",  venue: "Apex Hall, Nexis Campus",              attendees: 110, budget: 55000,  status: "completed", desc: "Live business case challenge with real client briefs." },
];

const CAMPAIGNS = [
  { name: "Open House push — September",  monthOffset:  1, dept: "marketing", objective: "Drive 250 registrations for the September open house.", channels: ["Instagram","Meta Ads","WhatsApp","School outreach"], budget: 85000,  status: "planned" },
  { name: "UG Round 5 admissions",        monthOffset:  0, dept: "admissions",objective: "Fill the remaining 40 UG seats before the intake closes.",  channels: ["Meta Ads","Google Ads","WhatsApp","Print"],       budget: 175000, status: "live" },
  { name: "NexConnect awareness",         monthOffset:  0, dept: "marketing", objective: "Build turnout and press coverage for the industry meet.",   channels: ["LinkedIn","Instagram","Email"],                   budget: 40000,  status: "in_progress" },
  { name: "Campus life content series",   monthOffset:  0, dept: "marketing", objective: "Weekly reels showing day-to-day life on campus.",           channels: ["Instagram","YouTube"],                            budget: 25000,  status: "in_progress" },
  { name: "Pitch Tank hype",              monthOffset:  1, dept: "marketing", objective: "Student sign-ups and mentor interest for Pitch Tank.",       channels: ["Instagram","WhatsApp"],                           budget: 30000,  status: "planned" },
  { name: "Early bird scholarship",       monthOffset: -1, dept: "admissions",objective: "Convert warm leads with the early bird fee waiver.",         channels: ["WhatsApp","Meta Ads","Email"],                    budget: 120000, status: "completed" },
  { name: "Board results congratulations",monthOffset: -1, dept: "marketing", objective: "Ride the board results moment for brand recall.",            channels: ["Instagram","Facebook","Outdoor"],                 budget: 60000,  status: "completed" },
];

const CREATIVES = [
  { title: "Open House announcement poster",   type: "poster",   channel: "Instagram", status: "approved",          caption: "Doors open 12 September. Come see how we actually teach business." },
  { title: "Open House story set (5 frames)",  type: "story",    channel: "Instagram", status: "pending",           caption: "Swipe-up story set driving registrations." },
  { title: "NexConnect invite — LinkedIn",     type: "banner",   channel: "LinkedIn",  status: "approved",          caption: "An evening with the people who hire our students." },
  { title: "Campus life reel — hostel day",    type: "reel",     channel: "Instagram", status: "changes_requested", caption: "A day in the life, shot on campus." },
  { title: "Pitch Tank teaser reel",           type: "reel",     channel: "Instagram", status: "pending",           caption: "Season 3. Bigger cheques, harder questions." },
  { title: "Round 5 admissions carousel",      type: "carousel", channel: "Meta Ads",  status: "approved",          caption: "40 seats left. Applications close 30 September." },
  { title: "Early bird scholarship banner",    type: "banner",   channel: "Meta Ads",  status: "approved",          caption: "Save ₹50,000 on your first year." },
  { title: "Faculty spotlight — Prof. Menon",  type: "image",    channel: "LinkedIn",  status: "pending",           caption: "20 years in consulting, now teaching our strategy core." },
  { title: "Parents orientation invite",       type: "image",    channel: "WhatsApp",  status: "approved",          caption: "Orientation for Batch 6 parents." },
  { title: "18 Under 18 launch creative",      type: "poster",   channel: "Instagram", status: "draft",             caption: "Nominations open soon." },
  { title: "Board results congratulations",    type: "image",    channel: "Instagram", status: "approved",          caption: "To everyone who just got their results — well done." },
  { title: "Placement report infographic",     type: "image",    channel: "Website",   status: "rejected",          caption: "2025-26 placement outcomes at a glance." },
];

const SCRIPTS = [
  { title: "Open House anchor script",        type: "speech",       status: "approved",          body: "Good morning everyone, and welcome to NEXIS.\n\nFor the next two hours you are going to see something different from a normal college visit. We are not going to read you a brochure. You are going to sit in a real class, meet students who are running real projects, and talk to faculty who have actually built businesses.\n\nLet me start with a question for the parents in the room. What is the one thing you want your child to walk out of college with?\n\n[pause for responses]\n\nHold that thought, because everything we show you today is built around exactly that." },
  { title: "Round 5 admissions call script",  type: "call",         status: "approved",          body: "Hi, am I speaking with {{name}}?\n\nThis is {{counsellor}} calling from NEXIS School of Business, Siliguri. You had filled out an enquiry form with us about our UG programme — is this a good time for two minutes?\n\n[if yes]\n\nGreat. I will keep it quick. We are in the final round for the July intake and there are about 40 seats left across the batch.\n\nBefore I tell you about the programme, can I ask — what is your son/daughter planning right now? Have they already taken admission somewhere?" },
  { title: "NexConnect invitation — WhatsApp",type: "whatsapp",     status: "pending",           body: "Hello {{name}},\n\nYou are invited to NexConnect, an evening with the founders and hiring managers who work most closely with NEXIS.\n\nDate: 3 August 2026\nTime: 6:00 pm onwards\nVenue: Mayfair Tea Resort, Siliguri\n\nIt is a small room by design — about 120 people. Dinner and networking follow the panel.\n\nPlease confirm by 30 July so we can hold your seat." },
  { title: "Campus life reel voiceover",      type: "reel",         status: "changes_requested", body: "6:40 am. Most of campus is still asleep.\n\nBut the Pitch Tank finalists have a demo in four days, and this is the only time the AV room is free.\n\nThis is not a story about studying hard. It is a story about what happens when the work is actually yours." },
  { title: "Pitch Tank announcement post",    type: "announcement", status: "pending",           body: "Pitch Tank is back for Season 3.\n\nLast season, two of our student teams walked out with real cheques and one is now doing ₹4 lakh a month.\n\nThis season the judging panel is bigger, the brief is harder, and the prize pool has doubled.\n\nRegistrations open Monday. Teams of two to four. First-years welcome." },
  { title: "Parents orientation email",       type: "email",        status: "approved",          body: "Dear Parent,\n\nWelcome to the NEXIS family.\n\nWe are holding an orientation session for parents of Batch 6 on 29 July at 10:00 am in Apex Hall on campus.\n\nWe will cover the academic structure, the internship timeline, how we handle attendance and discipline, and who to contact when you need something. There will be time for questions at the end.\n\nPlease confirm your attendance by replying to this email." },
  { title: "Fee reminder — WhatsApp",         type: "whatsapp",     status: "approved",          body: "Dear {{parent_name}},\n\nThis is a gentle reminder that the second instalment of fees for {{student_name}} is due on {{due_date}}.\n\nAmount: {{amount}}\n\nYou can pay online through the parent portal or at the campus accounts desk between 10 am and 4 pm on working days.\n\nIf you need to discuss a different schedule, please call us. We would rather talk than send reminders." },
];

const EXPENSES = [
  { title: "Standee and banner printing — Open House", amount: 18500, category: "printing",    vendor: "Siliguri Print House",     status: "approved", reimb: false, days: -3 },
  { title: "Chief guest hospitality — NexConnect",     amount: 32000, category: "food",        vendor: "Mayfair Tea Resort",       status: "pending",  reimb: false, days: -1 },
  { title: "Photographer — Voice of Nexis",            amount: 15000, category: "event",       vendor: "Lenscraft Studio",         status: "paid",     reimb: false, days: -20 },
  { title: "Travel to Kalimpong school outreach",      amount: 4200,  category: "travel",      vendor: null,                       status: "paid",     reimb: true,  days: -14 },
  { title: "Instagram ad spend — Round 5",             amount: 85000, category: "marketing",   vendor: "Meta Platforms",           status: "approved", reimb: false, days: -6 },
  { title: "Projector bulb replacement — Apex Hall",   amount: 7800,  category: "maintenance", vendor: "AV Solutions Siliguri",    status: "pending",  reimb: false, days: -2 },
  { title: "Stationery and badges — orientation",      amount: 6400,  category: "printing",    vendor: "Campus Stationers",        status: "pending",  reimb: true,  days: -1 },
  { title: "Team lunch — marketing offsite",           amount: 5600,  category: "food",        vendor: "Cafe Rio",                 status: "changes_requested", reimb: true, days: -5 },
  { title: "Laptop for admissions desk",               amount: 62000, category: "equipment",   vendor: "Reliance Digital",         status: "approved", reimb: false, days: -8 },
  { title: "Guest faculty honorarium — Prof. Menon",   amount: 25000, category: "salary",      vendor: null,                       status: "paid",     reimb: false, days: -25 },
  { title: "Campus wifi upgrade — quarterly",          amount: 48000, category: "utilities",   vendor: "Alliance Broadband",       status: "paid",     reimb: false, days: -30 },
  { title: "Sound system rental — Pitch Tank",         amount: 22000, category: "vendor",      vendor: "Beat Audio Rentals",       status: "draft",    reimb: false, days: 0 },
  { title: "Cab for airport pickup — guest speaker",   amount: 3200,  category: "travel",      vendor: null,                       status: "pending",  reimb: true,  days: -1 },
  { title: "Momentos and gifting — NexConnect",        amount: 19500, category: "event",       vendor: "Craft Bazaar",             status: "rejected", reimb: false, days: -4 },
];

const BOARDS = [
  { name: "Marketing sprint — August", dept: "marketing", desc: "Everything the marketing team is shipping this month." },
  { name: "Campus maintenance",        dept: "campus",    desc: "Facilities requests and upkeep across the campus." },
  { name: "Admissions Round 5",        dept: "admissions",desc: "Counselling follow-ups and conversion tracking." },
];

const BOARD_TASKS = {
  "Marketing sprint — August": [
    { title: "Shoot campus life reel — library and cafeteria", col: 1, pri: "normal" },
    { title: "Rewrite the UG landing page hero copy",           col: 1, pri: "high" },
    { title: "Design Round 5 carousel — 5 frames",              col: 3, pri: "high" },
    { title: "Set up Meta pixel on the application flow",       col: 0, pri: "urgent" },
    { title: "Monthly performance report for August",           col: 0, pri: "normal" },
    { title: "Collect 5 student testimonials on video",         col: 1, pri: "normal" },
    { title: "Refresh the Google Business profile photos",      col: 0, pri: "low" },
    { title: "Publish placement report infographic",            col: 2, pri: "high" },
  ],
  "Campus maintenance": [
    { title: "Fix the AC in Legacy Hall",                       col: 1, pri: "urgent" },
    { title: "Repaint the reception wall before Open House",    col: 0, pri: "high" },
    { title: "Service all classroom projectors",                col: 2, pri: "normal" },
    { title: "Replace broken chairs in the cafeteria",          col: 0, pri: "normal" },
    { title: "Deep clean the hostel common room",               col: 3, pri: "low" },
  ],
  "Admissions Round 5": [
    { title: "Call back the 40 warm leads from the Kalimpong drive", col: 1, pri: "urgent" },
    { title: "Verify documents for 12 provisional admissions",       col: 1, pri: "high" },
    { title: "Send fee structure to shortlisted applicants",         col: 3, pri: "high" },
    { title: "Update the CRM with last week's walk-ins",             col: 0, pri: "normal" },
  ],
};

const REGISTRATION_NAMES = [
  "Aarav Agarwal","Diya Sharma","Rohit Chettri","Sneha Roy","Arjun Thapa","Kavya Bose",
  "Nikhil Gurung","Ananya Das","Rishab Jain","Tanvi Pradhan","Kabir Singh","Meghna Sarkar",
  "Aditya Rai","Pooja Limbu","Sameer Khan","Riya Ghosh","Yash Bhutia","Anjali Mishra",
  "Dev Agarwal","Shreya Dutta","Manav Kapoor","Isha Subba","Aryan Saha","Nandini Rao",
];

/* ── DB helpers ───────────────────────────────────────────────────────────── */

async function connect() {
  const hosts = [
    { host: "aws-1-ap-south-1.pooler.supabase.com", user: `postgres.${REF}` },
    { host: "aws-0-ap-south-1.pooler.supabase.com", user: `postgres.${REF}` },
  ];
  for (const h of hosts) {
    const client = new pg.Client({
      host: h.host,
      port: 5432,
      user: h.user,
      password: DB_PASSWORD,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
      statement_timeout: 180000,
    });
    try {
      await client.connect();
      return client;
    } catch {
      try { await client.end(); } catch {}
    }
  }
  throw new Error("Could not connect to Postgres");
}

const authHeaders = {
  "Content-Type": "application/json",
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

/** Create an auth user, or return the existing one's id. */
async function ensureAuthUser(person) {
  const res = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      email: person.email,
      password: "NexisDemo@2026",
      email_confirm: true,
      user_metadata: { full_name: person.name, phone: person.phone },
    }),
  });
  const json = await res.json();
  if (res.ok && json?.id) return json.id;

  const msg = json?.msg || json?.message || "";
  if (!/already/i.test(msg)) throw new Error(`${person.email}: ${msg}`);

  const lookup = await fetch(
    `${URL}/auth/v1/admin/users?filter=${encodeURIComponent(person.email)}`,
    { headers: authHeaders }
  );
  const list = await lookup.json();
  const found = list?.users?.find((u) => u.email?.toLowerCase() === person.email.toLowerCase());
  if (!found) throw new Error(`could not resolve ${person.email}`);
  return found.id;
}

async function deleteAuthUser(id) {
  await fetch(`${URL}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: authHeaders });
}

/* ── Reset ────────────────────────────────────────────────────────────────── */

async function reset(db) {
  console.log("resetting demo data…");

  const { rows } = await db.query(
    `select id from profiles where email like '%@nexisschool.com'`
  );

  // Most rows cascade from profiles or events; clear the rest explicitly so a
  // reseed does not stack duplicates.
  await db.query(`delete from approval_comments`);
  await db.query(`delete from approval_requests`);
  await db.query(`delete from task_comments`);
  await db.query(`delete from task_checklist_items`);
  await db.query(`delete from tasks`);
  await db.query(`delete from board_columns`);
  await db.query(`delete from boards`);
  await db.query(`delete from expenses`);
  await db.query(`delete from creatives`);
  await db.query(`delete from scripts`);
  await db.query(`delete from event_registrations`);
  await db.query(`delete from marketing_campaigns`);
  await db.query(`delete from events`);
  await db.query(`delete from notifications`);
  await db.query(`delete from activity_log`);
  await db.query(`delete from reminders`);
  await db.query(`delete from message_log`);
  await db.query(`delete from department_members`);

  for (const row of rows) await deleteAuthUser(row.id);
  console.log(`  removed ${rows.length} demo user(s) and their data`);
}

/* ── Seed ─────────────────────────────────────────────────────────────────── */

async function seed(db) {
  const { rows: deptRows } = await db.query(`select id, slug from departments`);
  const dept = Object.fromEntries(deptRows.map((d) => [d.slug, d.id]));

  // — People —
  console.log("creating team…");
  const people = [];
  for (const person of PEOPLE) {
    const id = await ensureAuthUser(person);
    await db.query(
      `update profiles
          set full_name = $2, role = $3, phone = $4, job_title = $5,
              primary_department_id = $6, is_active = true, whatsapp_opt_in = true
        where id = $1`,
      [id, person.name, person.role, person.phone, person.title, dept[person.dept]]
    );
    await db.query(
      `insert into department_members (department_id, user_id, is_manager)
       values ($1, $2, $3)
       on conflict (department_id, user_id) do update set is_manager = excluded.is_manager`,
      [dept[person.dept], id, person.role === "manager"]
    );
    people.push({ ...person, id });
  }
  console.log(`  ${people.length} people`);

  const { rows: adminRows } = await db.query(
    `select id, full_name from profiles where role = 'super_admin' limit 1`
  );
  const admin = adminRows[0];
  const byDept = (slug) => people.filter((p) => p.dept === slug);
  const managerOf = (slug) => byDept(slug).find((p) => p.role === "manager") ?? people[0];
  const everyone = [...people, ...(admin ? [{ id: admin.id, name: admin.full_name }] : [])];

  // — Events, with playbook-derived checklists —
  console.log("creating events…");
  const { rows: playbookItems } = await db.query(
    `select * from event_playbook_items
      where playbook_id = '00000000-0000-0000-0000-000000000001'
      order by sort_order`
  );

  const eventIds = {};
  for (const event of EVENTS) {
    const starts = daysFromNow(event.offset, 10);
    const slug = event.name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
    const owner = managerOf(event.dept);

    const { rows } = await db.query(
      `insert into events (name, slug, description, department_id, owner_id, status,
                           starts_at, ends_at, venue, expected_attendees, budget_amount,
                           registration_enabled, created_by, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$5,$13)
       on conflict (slug) do update set name = excluded.name
       returning id`,
      [
        event.name, slug, event.desc, dept[event.dept], owner.id, event.status,
        starts, new Date(starts.getTime() + 5 * 3600 * 1000), event.venue,
        event.attendees, event.budget, event.offset > 0,
        daysFromNow(event.offset - int(35, 60)),
      ]
    );
    const eventId = rows[0].id;
    eventIds[event.name] = eventId;

    // How far along the checklist should be, given where the event sits in time.
    const completion =
      event.status === "completed" ? 1
      : event.status === "ready"   ? 0.8
      : event.offset < 15          ? 0.55
      : event.offset < 40          ? 0.3
      : 0.08;

    const team = byDept(event.dept).length ? byDept(event.dept) : people;

    for (const item of playbookItems) {
      const due = new Date(starts.getTime() + item.offset_days * day);
      due.setHours(18, 0, 0, 0);

      const isPast = due < now;
      const done = isPast ? chance(Math.min(completion + 0.25, 0.97)) : chance(completion * 0.35);
      const status = done ? "done" : isPast && chance(0.18) ? "in_progress" : "todo";

      // Leave a few genuinely unassigned so the assign flow has something to do.
      const assignee = chance(0.85) ? pick(team) : null;
      const priority =
        !done && due < now ? (chance(0.4) ? "urgent" : "high")
        : chance(0.15) ? "high"
        : "normal";

      await db.query(
        `insert into tasks (title, description, event_id, category, department_id,
                            assignee_id, created_by, due_at, sort_order, status,
                            priority, completed_at, completed_by, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          item.title, item.description, eventId, item.category,
          item.department_id ?? dept[event.dept],
          assignee?.id ?? null, owner.id, due, item.sort_order, status, priority,
          done ? new Date(due.getTime() - int(0, 3) * day) : null,
          done ? assignee?.id ?? owner.id : null,
          daysFromNow(event.offset - int(35, 60)),
        ]
      );
    }
  }
  console.log(`  ${EVENTS.length} events with full checklists`);

  // — Comments on a slice of tasks, so threads are not all empty —
  const { rows: someTasks } = await db.query(
    `select id, assignee_id from tasks where assignee_id is not null order by random() limit 40`
  );
  const COMMENT_POOL = [
    "Spoke to the vendor, they can deliver by Thursday.",
    "Waiting on the budget approval before I can confirm this.",
    "Done — shared the final files on the drive.",
    "Can we push this by two days? The venue hasn't confirmed yet.",
    "Following up again today. No response since Monday.",
    "Priya has the quotation, will attach it here once approved.",
    "Blocked: need the approved creative before I can send this out.",
    "Confirmed on call. Written confirmation coming by email.",
    "Moved this to next week, the printer is closed for the festival.",
    "All set. Just needs a final review before it goes out.",
  ];
  for (const task of someTasks) {
    for (let i = 0; i < int(1, 3); i++) {
      const author = pick(everyone);
      await db.query(
        `insert into task_comments (task_id, author_id, body, created_at) values ($1,$2,$3,$4)`,
        [task.id, author.id, pick(COMMENT_POOL), daysFromNow(-int(1, 20), int(9, 18))]
      );
    }
  }
  console.log(`  comments on ${someTasks.length} tasks`);

  // — Campaigns —
  console.log("creating marketing…");
  const campaignIds = {};
  for (const campaign of CAMPAIGNS) {
    const month = new Date(now.getFullYear(), now.getMonth() + campaign.monthOffset, 1);
    const owner = managerOf(campaign.dept);
    const { rows } = await db.query(
      `insert into marketing_campaigns (name, month, objective, channels, status,
                                        department_id, owner_id, budget_amount,
                                        created_by, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$7,$9)
       returning id`,
      [
        campaign.name,
        `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-01`,
        campaign.objective, campaign.channels, campaign.status,
        dept[campaign.dept], owner.id, campaign.budget,
        daysFromNow(-int(10, 50)),
      ]
    );
    campaignIds[campaign.name] = rows[0].id;
  }

  const campaignList = Object.values(campaignIds);
  const marketing = byDept("marketing");
  const marketingManager = managerOf("marketing");

  // — Creatives and scripts, each with a matching approval trail —
  async function raiseApproval(entityType, entityId, title, status, requester, version = 1) {
    const created = daysFromNow(-int(1, 12), int(10, 17));
    const decided = status === "pending" ? null : new Date(created.getTime() + int(4, 40) * 3600 * 1000);

    const { rows } = await db.query(
      `insert into approval_requests (entity_type, entity_id, title, department_id,
                                      requested_by, assigned_to, status, version,
                                      decided_by, decided_at, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       returning id`,
      [
        entityType, entityId, title, dept.marketing, requester.id,
        marketingManager.id, status, version,
        decided ? marketingManager.id : null, decided, created,
      ]
    );

    if (status === "changes_requested") {
      await db.query(
        `insert into approval_comments (request_id, author_id, body, decision, created_at)
         values ($1,$2,$3,$4,$5)`,
        [
          rows[0].id, marketingManager.id,
          "The logo lockup is off-brand — use the white mark on the dark background, and the pink needs to be #EF3A5D exactly. Also the headline is one line too long on mobile.",
          "changes_requested", decided,
        ]
      );
    } else if (status === "rejected") {
      await db.query(
        `insert into approval_comments (request_id, author_id, body, decision, created_at)
         values ($1,$2,$3,$4,$5)`,
        [
          rows[0].id, marketingManager.id,
          "We can't publish placement numbers until the audit is signed off. Parking this until Finance confirms.",
          "rejected", decided,
        ]
      );
    }
  }

  for (const creative of CREATIVES) {
    const creator = pick(marketing);
    const version = creative.status === "changes_requested" ? 2 : 1;
    const { rows } = await db.query(
      `insert into creatives (title, type, channel, caption, status, campaign_id,
                              department_id, created_by, version, created_at, published_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       returning id`,
      [
        creative.title, creative.type, creative.channel, creative.caption, creative.status,
        chance(0.75) ? pick(campaignList) : null, dept.marketing, creator.id, version,
        daysFromNow(-int(2, 25), int(9, 18)),
        creative.status === "approved" && chance(0.5) ? daysFromNow(-int(1, 10)) : null,
      ]
    );
    if (creative.status !== "draft") {
      await raiseApproval("creative", rows[0].id, creative.title, creative.status, creator, version);
    }
  }

  for (const script of SCRIPTS) {
    const creator = pick(marketing);
    const { rows } = await db.query(
      `insert into scripts (title, type, body, status, campaign_id, department_id,
                            created_by, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning id`,
      [
        script.title, script.type, script.body, script.status,
        chance(0.6) ? pick(campaignList) : null, dept.marketing, creator.id,
        daysFromNow(-int(2, 22), int(9, 18)),
      ]
    );
    if (script.status !== "draft") {
      await raiseApproval("script", rows[0].id, script.title, script.status, creator);
    }
  }
  console.log(`  ${CAMPAIGNS.length} campaigns, ${CREATIVES.length} creatives, ${SCRIPTS.length} scripts`);

  // — Expenses —
  console.log("creating expenses…");
  const financeManager = managerOf("finance");
  for (const expense of EXPENSES) {
    const requester = pick(people);
    const created = daysFromNow(expense.days, int(10, 17));
    const approved = ["approved", "paid"].includes(expense.status);
    const paid = expense.status === "paid";

    const { rows } = await db.query(
      `insert into expenses (title, description, amount, category, status, vendor,
                             expense_date, is_reimbursement, department_id, event_id,
                             requested_by, approver_id, approved_by, approved_at,
                             paid_at, paid_by, payment_method, payment_ref, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       returning id`,
      [
        expense.title,
        expense.reimb ? "Paid out of pocket, receipt attached." : "Vendor invoice attached, payment due on delivery.",
        expense.amount, expense.category, expense.status, expense.vendor,
        created.toISOString().slice(0, 10), expense.reimb,
        dept[requester.dept],
        chance(0.5) ? pick(Object.values(eventIds)) : null,
        requester.id, financeManager.id,
        approved ? financeManager.id : null,
        approved ? new Date(created.getTime() + int(4, 30) * 3600 * 1000) : null,
        paid ? new Date(created.getTime() + int(2, 6) * day) : null,
        paid ? financeManager.id : null,
        paid ? pick(["Bank transfer", "UPI", "Cheque"]) : null,
        paid ? `UTR${int(100000000, 999999999)}` : null,
        created,
      ]
    );

    if (expense.status !== "draft") {
      const decided = ["approved", "paid", "rejected", "changes_requested"].includes(expense.status);
      const approvalStatus = expense.status === "paid" ? "approved" : expense.status;
      await db.query(
        `insert into approval_requests (entity_type, entity_id, title, department_id,
                                        requested_by, assigned_to, status, decided_by,
                                        decided_at, created_at)
         values ('expense',$1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          rows[0].id,
          `${expense.title} — ₹${expense.amount.toLocaleString("en-IN")}`,
          dept[requester.dept], requester.id, financeManager.id, approvalStatus,
          decided ? financeManager.id : null,
          decided ? new Date(created.getTime() + int(4, 30) * 3600 * 1000) : null,
          created,
        ]
      );
    }
  }
  console.log(`  ${EXPENSES.length} expenses`);

  // — Boards —
  console.log("creating boards…");
  const COLUMNS = ["To do", "In progress", "Review", "Done"];
  for (const board of BOARDS) {
    const owner = managerOf(board.dept);
    const { rows } = await db.query(
      `insert into boards (name, description, department_id, created_by, created_at)
       values ($1,$2,$3,$4,$5) returning id`,
      [board.name, board.desc, dept[board.dept], owner.id, daysFromNow(-int(20, 60))]
    );
    const boardId = rows[0].id;

    const columnIds = [];
    for (let i = 0; i < COLUMNS.length; i++) {
      const { rows: col } = await db.query(
        `insert into board_columns (board_id, name, sort_order) values ($1,$2,$3) returning id`,
        [boardId, COLUMNS[i], i]
      );
      columnIds.push(col[0].id);
    }

    const team = byDept(board.dept).length ? byDept(board.dept) : people;
    for (const task of BOARD_TASKS[board.name] ?? []) {
      const status =
        task.col === 3 ? "done" : task.col === 0 ? "todo" : "in_progress";
      await db.query(
        `insert into tasks (title, board_id, column_id, department_id, assignee_id,
                            created_by, status, priority, due_at, sort_order,
                            completed_at, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          task.title, boardId, columnIds[task.col], dept[board.dept],
          chance(0.9) ? pick(team).id : null, owner.id, status, task.pri,
          daysFromNow(int(-6, 18), 18), int(0, 100),
          task.col === 3 ? daysFromNow(-int(1, 8)) : null,
          daysFromNow(-int(5, 30)),
        ]
      );
    }
  }
  console.log(`  ${BOARDS.length} boards`);

  // — Registrations for the events that collect them —
  console.log("creating registrations…");
  let registrationCount = 0;
  for (const [name, id] of Object.entries(eventIds)) {
    const event = EVENTS.find((e) => e.name === name);
    if (!event || event.offset < 0) continue;

    const count = Math.round(event.attendees * (event.offset < 15 ? 0.55 : 0.18));
    for (let i = 0; i < count; i++) {
      const person = REGISTRATION_NAMES[i % REGISTRATION_NAMES.length];
      const suffix = i >= REGISTRATION_NAMES.length ? ` ${Math.floor(i / REGISTRATION_NAMES.length) + 1}` : "";
      await db.query(
        `insert into event_registrations (event_id, full_name, email, phone, status, source, extra, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          id, person + suffix,
          `${person.toLowerCase().replace(/\s+/g, ".")}${suffix.trim()}@gmail.com`,
          `9${int(100000000, 999999999)}`,
          chance(0.9) ? "registered" : "waitlist",
          pick(["Instagram", "Website", "WhatsApp", "Walk-in", "Referral", "School outreach"]),
          JSON.stringify({
            school: pick(["Delhi Public School Siliguri","St. Joseph's","Techno India","G.D. Goenka","Army Public School"]),
            stream: pick(["Commerce", "Science", "Arts"]),
          }),
          daysFromNow(-int(1, 25), int(9, 21)),
        ]
      );
      registrationCount++;
    }
  }
  console.log(`  ${registrationCount} registrations`);

  // — Notifications and activity —
  const { rows: pendingApprovals } = await db.query(
    `select id, title, assigned_to from approval_requests where status = 'pending'`
  );
  for (const approval of pendingApprovals) {
    if (!approval.assigned_to) continue;
    await db.query(
      `insert into notifications (user_id, title, body, url, entity_type, entity_id, created_at)
       values ($1,$2,$3,'/approvals','approval',$4,$5)`,
      [
        approval.assigned_to, "Waiting for your approval", approval.title,
        approval.id, daysFromNow(-int(0, 5), int(9, 18)),
      ]
    );
  }

  const ACTIVITY = [
    ["event.created", "event", "Created event"],
    ["approval.approved", "creative", "Approved"],
    ["task.completed", "task", "Completed"],
    ["expense.submitted", "expense", "Submitted expense"],
    ["campaign.created", "campaign", "Created campaign"],
  ];
  for (let i = 0; i < 30; i++) {
    const [action, entity, verb] = pick(ACTIVITY);
    const actor = pick(everyone);
    await db.query(
      `insert into activity_log (actor_id, action, entity_type, summary, created_at)
       values ($1,$2,$3,$4,$5)`,
      [actor.id, action, entity, `${verb} — ${pick(EVENTS).name}`, daysFromNow(-int(0, 30), int(9, 19))]
    );
  }
  console.log(`  ${pendingApprovals.length} notifications, 30 activity entries`);
}

/* ── Run ──────────────────────────────────────────────────────────────────── */

const db = await connect();
try {
  if (RESET) await reset(db);
  await seed(db);

  const { rows } = await db.query(`
    select
      (select count(*) from profiles)            as people,
      (select count(*) from events)              as events,
      (select count(*) from tasks)               as tasks,
      (select count(*) from task_comments)       as comments,
      (select count(*) from marketing_campaigns) as campaigns,
      (select count(*) from creatives)           as creatives,
      (select count(*) from scripts)             as scripts,
      (select count(*) from expenses)            as expenses,
      (select count(*) from approval_requests)   as approvals,
      (select count(*) from boards)              as boards,
      (select count(*) from event_registrations) as registrations
  `);
  console.log("\ndone:", rows[0]);
  console.log("\nDemo accounts sign in with password: NexisDemo@2026");
} finally {
  await db.end();
}
