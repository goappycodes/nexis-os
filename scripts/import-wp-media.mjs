/**
 * Import brand imagery from the live nexisschool.com WordPress server.
 *
 *   node scripts/import-wp-media.mjs fetch     pull the curated set over SSH
 *   node scripts/import-wp-media.mjs upload    optimise and push to Supabase
 *   node scripts/import-wp-media.mjs           do both
 *
 * The server has 2,422 originals totalling 3.2 GB, which would blow through
 * the Supabase storage allowance and make the library unusable anyway. So this
 * takes a curated set, downscales to a sensible web size locally (the server
 * has no ImageMagick), and uploads that.
 *
 * Deliberately excluded: wp_dndcf7_uploads, cfdb7_uploads and wpforms
 * directories. Those hold contact-form attachments — applicant documents and
 * personal data that have no business in a staff brand library.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
dotenv.config({ path: join(root, ".env.local") });

const SSH = "forge@157.245.101.141";
const REMOTE = "/home/forge/nexisschool.com/wp-content/uploads";
const STAGE = join(root, ".media-staging");

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const REF = process.env.SUPABASE_PROJECT_REF;

/**
 * The curated set. `file` is relative to the uploads root; where WordPress
 * made a "-scaled" copy that one is preferred, since the original is often a
 * 12 MB camera JPEG nobody needs.
 */
const ASSETS = [
  // ── Brand marks ─────────────────────────────────────────────────────────
  { file: "2024/10/nexis-logo-dark-1.png", name: "Nexis logo — dark", category: "logo", tags: ["logo", "primary", "light-background"], pinned: true, keepSize: true,
    description: "Primary logo for light backgrounds." },
  { file: "2024/11/nexis-white-logo.png", name: "Nexis logo — white", category: "logo", tags: ["logo", "reversed", "dark-background"], pinned: true, keepSize: true,
    description: "Reversed logo for dark or photographic backgrounds." },
  { file: "2026/01/Nexis-Logo-Big.png", name: "Nexis logo — large", category: "logo", tags: ["logo", "print", "high-res"], pinned: true, keepSize: true,
    description: "Large format logo for print, standees and backdrops." },
  { file: "2024/10/favicon.png", name: "Nexis mark", category: "icon", tags: ["logo", "mark", "favicon"], pinned: true, keepSize: true,
    description: "Square mark, for avatars, favicons and tight spaces." },
  { file: "2025/12/nexis-ai-logo.png", name: "Nexis School of AI logo", category: "logo", tags: ["logo", "sub-brand", "ai"], keepSize: true,
    description: "Sub-brand logo for the School of AI." },

  // ── Accreditation and recognition ───────────────────────────────────────
  { file: "2025/01/mepsc-white.png", name: "MEPSC mark (white)", category: "logo", tags: ["accreditation", "mepsc"], keepSize: true,
    description: "Sector Skill Council affiliation mark, reversed." },
  { file: "2025/01/ncvet.png", name: "NCVET mark", category: "logo", tags: ["accreditation", "ncvet"], keepSize: true,
    description: "NCVET recognition mark. Required on programme collateral." },
  { file: "2025/01/skill-ministry.png", name: "Ministry of Skill Development mark", category: "logo", tags: ["accreditation", "government"], keepSize: true,
    description: "Ministry of Skill Development & Entrepreneurship mark." },
  { file: "2025/01/startupindia-white.png", name: "Startup India mark (white)", category: "logo", tags: ["accreditation", "dpiit", "startup-india"], keepSize: true,
    description: "DPIIT Startup India recognition, reversed." },
  { file: "2025/01/dpiit.png", name: "DPIIT mark", category: "logo", tags: ["accreditation", "dpiit"], keepSize: true },
  { file: "2025/01/recruiters-nexis.jpg", name: "Hiring partners board", category: "photo", tags: ["recruiters", "placements", "partners"],
    description: "Composite of hiring partner logos, for placement collateral." },

  // ── Campus ──────────────────────────────────────────────────────────────
  { file: "2026/01/Cafeteria.jpg", name: "Campus — Cafeteria", category: "photo", tags: ["campus", "student-life"] },
  { file: "2026/01/Campus-Environment.png", name: "Campus environment", category: "photo", tags: ["campus", "exterior"] },
  { file: "2025/12/Business-Management-Classroom-at-Nexis.jpg", name: "Campus — Classroom", category: "photo", tags: ["campus", "classroom", "academics"] },
  { file: "2025/12/Nexis-Business-Management-Classroom-.jpg", name: "Campus — Classroom (wide)", category: "photo", tags: ["campus", "classroom", "academics"] },
  { file: "2025/12/Business-Management-Course-Classroom.jpg", name: "Campus — Class in session", category: "photo", tags: ["campus", "classroom", "teaching"] },

  // ── Student life ────────────────────────────────────────────────────────
  { file: "2025/12/Cricket-scaled.jpg", name: "Sports — Cricket", category: "photo", tags: ["sports", "student-life", "cricket"] },
  { file: "2025/01/Copy-of-Cricket-scaled.jpg", name: "Sports — Cricket match", category: "photo", tags: ["sports", "student-life", "cricket"] },
  { file: "2025/01/Sports-showdown.jpg", name: "Sports Showdown", category: "photo", tags: ["sports", "event", "student-life"] },
  { file: "2025/12/Student-run-club-min-scaled.jpg", name: "Student-run club", category: "photo", tags: ["clubs", "student-life"] },
  { file: "2025/01/Campus-celebration.jpg", name: "Campus celebration", category: "photo", tags: ["student-life", "celebration", "event"] },
  { file: "2024/11/Student-photos.png", name: "Students on campus", category: "photo", tags: ["students", "campus"] },

  // ── Events and programmes ───────────────────────────────────────────────
  { file: "2025/07/Startup-founders-min-scaled.jpg", name: "Startup founders session", category: "photo", tags: ["event", "founders", "mentors"] },
  { file: "2025/12/STARTUP-WEEKENDER.jpeg", name: "Startup Weekender", category: "photo", tags: ["event", "startup", "competition"] },
  { file: "2025/01/Masterclass.jpeg", name: "Masterclass", category: "photo", tags: ["event", "masterclass", "teaching"] },
  { file: "2025/01/Industry-visit.jpeg", name: "Industry visit", category: "photo", tags: ["event", "industry", "exposure"] },
  { file: "2025/12/Industry.jpeg", name: "Industry session", category: "photo", tags: ["event", "industry"] },
  { file: "2025/12/Pre-orientation.jpg", name: "Pre-orientation", category: "photo", tags: ["event", "orientation", "admissions"] },
  { file: "2025/12/Orientation-video.jpg", name: "Orientation", category: "photo", tags: ["event", "orientation"] },
  { file: "2026/07/Cinema-Industry-Visit-for-NEXIS-School-of-Business-Students.png", name: "Cinema industry visit", category: "photo", tags: ["event", "industry", "exposure"] },
  { file: "2026/07/NEXIS-Scholarship-NES-Awards.png", name: "NES Scholarship Awards", category: "photo", tags: ["event", "awards", "scholarship"] },
  { file: "2026/07/How-NEXIS-Students-Learn-to-Pitch-and-Sell.png", name: "Pitch and sell workshop", category: "photo", tags: ["event", "pitch", "teaching"] },
  { file: "2026/07/First-Year-Internships-at-NEXIS-School-of-Business.png", name: "First year internships", category: "photo", tags: ["internship", "students"] },
  { file: "2026/01/Experience-Faculty.png", name: "Faculty with industry experience", category: "photo", tags: ["faculty", "teaching"] },
  { file: "2025/12/admission-student-min-scaled.jpg", name: "Admissions counselling", category: "photo", tags: ["admissions", "counselling"] },

  // ── Publications ────────────────────────────────────────────────────────
  { file: "2026/05/NEXIS-Yearbook-pdf.jpg", name: "Yearbook cover", category: "document", tags: ["yearbook", "publication", "cover"] },
  { file: "2026/01/Yearbook-2025-pdf.jpg", name: "Yearbook 2025 cover", category: "document", tags: ["yearbook", "publication", "cover"] },
  { file: "2025/12/MASTERCLASS-Report-pdf.jpg", name: "Masterclass report cover", category: "document", tags: ["report", "publication", "masterclass"] },
  { file: "2026/06/NEXIS-Summer-Internship-Report-2026-pdf.jpg", name: "Summer Internship Report 2026 cover", category: "document", tags: ["report", "internship", "publication"] },

  // ── Social icons, used across creatives ─────────────────────────────────
  { file: "2026/01/Instagram.svg", name: "Instagram icon", category: "icon", tags: ["social", "icon"], keepSize: true, raw: true },
  { file: "2026/01/Linkedin.svg", name: "LinkedIn icon", category: "icon", tags: ["social", "icon"], keepSize: true, raw: true },
  { file: "2026/01/YouTube.svg", name: "YouTube icon", category: "icon", tags: ["social", "icon"], keepSize: true, raw: true },
];

/* ── Fetch ────────────────────────────────────────────────────────────────── */

function fetchAll() {
  if (!existsSync(STAGE)) mkdirSync(STAGE, { recursive: true });

  // One scp invocation for the lot: 40 separate SSH handshakes is slow and
  // hammers the server for no reason.
  const remotePaths = ASSETS.map((a) => `${REMOTE}/${a.file}`);
  const spec = `${SSH}:"${remotePaths.join('" "')}"`;

  console.log(`fetching ${ASSETS.length} files…`);
  try {
    execFileSync("scp", ["-o", "BatchMode=yes", ...remotePaths.map((p) => `${SSH}:${p}`), STAGE], {
      stdio: ["ignore", "inherit", "inherit"],
      shell: false,
    });
  } catch {
    console.log("(some files were missing on the server — continuing with what arrived)");
  }
  void spec;

  const got = readdirSync(STAGE);
  console.log(`staged ${got.length} file(s)`);
}

/* ── Optimise and upload ──────────────────────────────────────────────────── */

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

async function connect() {
  for (const host of [
    "aws-1-ap-south-1.pooler.supabase.com",
    "aws-0-ap-south-1.pooler.supabase.com",
  ]) {
    const client = new pg.Client({
      host,
      port: 5432,
      user: `postgres.${REF}`,
      password: DB_PASSWORD,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
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

async function uploadAll() {
  const db = await connect();

  try {
    const { rows: admin } = await db.query(
      `select id from profiles where role = 'super_admin' order by created_at limit 1`
    );
    const uploader = admin[0]?.id ?? null;

    const { rows: existing } = await db.query(`select name from brand_assets`);
    const have = new Set(existing.map((r) => r.name));

    let added = 0;
    let skipped = 0;
    let saved = 0;

    for (const asset of ASSETS) {
      const localName = basename(asset.file);
      const localPath = join(STAGE, localName);

      if (!existsSync(localPath)) {
        console.log(`! ${asset.name} — not staged, skipping`);
        continue;
      }
      if (have.has(asset.name)) {
        console.log(`= ${asset.name}`);
        skipped++;
        continue;
      }

      const ext = extname(localName).toLowerCase();
      const originalSize = statSync(localPath).size;

      let bytes;
      let mime = MIME[ext] ?? "application/octet-stream";
      let outName = localName;

      if (asset.raw || ext === ".svg") {
        bytes = readFileSync(localPath);
      } else if (asset.keepSize) {
        // Logos and marks keep their dimensions; only recompress.
        bytes = await sharp(localPath).png({ compressionLevel: 9 }).toBuffer();
        mime = "image/png";
        outName = localName.replace(/\.[^.]+$/, ".png");
      } else {
        // Photos: nobody needs a 12 MB camera original in a brand library.
        bytes = await sharp(localPath)
          .rotate()
          .resize({ width: 1800, withoutEnlargement: true })
          .jpeg({ quality: 82, mozjpeg: true })
          .toBuffer();
        mime = "image/jpeg";
        outName = localName.replace(/\.[^.]+$/, ".jpg");
      }

      saved += originalSize - bytes.length;

      const safe = outName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${asset.category}/${safe}`;

      process.stdout.write(
        `+ ${asset.name} (${(originalSize / 1024).toFixed(0)}→${(bytes.length / 1024).toFixed(0)} KB) … `
      );

      const res = await fetch(`${URL_BASE}/storage/v1/object/brand/${encodeURI(path)}`, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": mime,
          "x-upsert": "true",
        },
        body: bytes,
      });

      if (!res.ok) {
        console.log("FAILED");
        console.log(`   ${await res.text()}`);
        continue;
      }

      await db.query(
        `insert into brand_assets
           (name, description, category, file_path, file_size, mime_type, tags, is_pinned, uploaded_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          asset.name,
          asset.description ?? null,
          asset.category,
          path,
          bytes.length,
          mime,
          asset.tags ?? [],
          Boolean(asset.pinned),
          uploader,
        ]
      );

      console.log("ok");
      added++;
    }

    const { rows } = await db.query(
      `select count(*) as n, coalesce(sum(file_size),0) as bytes from brand_assets`
    );
    console.log(`\nadded ${added}, skipped ${skipped}`);
    console.log(`saved ${(saved / 1048576).toFixed(1)} MB by downscaling`);
    console.log(
      `library: ${rows[0].n} assets, ${(Number(rows[0].bytes) / 1048576).toFixed(1)} MB stored`
    );
  } finally {
    await db.end();
  }
}

const cmd = process.argv[2];
if (!cmd || cmd === "fetch") fetchAll();
if (!cmd || cmd === "upload") await uploadAll();
