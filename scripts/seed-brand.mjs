/**
 * Upload the real Nexis brand assets into the library.
 *
 *   node scripts/seed-brand.mjs
 *
 * Idempotent: an asset already in the library by name is skipped, so this can
 * be re-run after adding new files to the list below.
 *
 * Source files live outside the repo (they are large and not code), so this
 * reads them from disk and pushes them to Supabase Storage.
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const REF = process.env.SUPABASE_PROJECT_REF;

const HOME = process.env.USERPROFILE || process.env.HOME;
const WEB = join(HOME, "Desktop", "projects", "nexis-website", "nexis-web", "public", "images");
const DOCS = join(HOME, "Desktop", "NEXIS DOCUMENTS");

const ASSETS = [
  {
    file: join(WEB, "logo-dark.png"),
    name: "Nexis logo — dark",
    category: "logo",
    description: "Primary logo for light backgrounds.",
    tags: ["logo", "primary", "light-background"],
    pinned: true,
  },
  {
    file: join(WEB, "logo-white.png"),
    name: "Nexis logo — white",
    category: "logo",
    description: "Reversed logo for dark or photographic backgrounds.",
    tags: ["logo", "reversed", "dark-background"],
    pinned: true,
  },
  {
    file: join(WEB, "logo-big.png"),
    name: "Nexis logo — high resolution",
    category: "logo",
    description: "Large format logo for print, standees and backdrops.",
    tags: ["logo", "print", "high-res"],
    pinned: true,
  },
  {
    file: join(DOCS, "NEW BROCHURE", "nexis new brochure.pdf"),
    name: "Nexis brochure (current)",
    category: "document",
    description: "The current approved brochure. Do not circulate older versions.",
    tags: ["brochure", "admissions", "print"],
    pinned: true,
  },
  {
    file: join(DOCS, "NEXIS CAMPUS PICTURES", "NEXIS HQ.jpg"),
    name: "Campus — NEXIS HQ",
    category: "photo",
    description: "Exterior of the Nexis campus building.",
    tags: ["campus", "exterior", "photo"],
  },
  {
    file: join(DOCS, "NEXIS CAMPUS PICTURES", "apex hall.jpg"),
    name: "Campus — Apex Hall",
    category: "photo",
    description: "Apex Hall, the main event and seminar venue.",
    tags: ["campus", "venue", "apex-hall", "events"],
  },
  {
    file: join(DOCS, "NEXIS CAMPUS PICTURES", "legacy hall.jpg"),
    name: "Campus — Legacy Hall",
    category: "photo",
    description: "Legacy Hall, used for competitions and cultural events.",
    tags: ["campus", "venue", "legacy-hall", "events"],
  },
  {
    file: join(DOCS, "NEXIS CAMPUS PICTURES", "Reception.jpg"),
    name: "Campus — Reception",
    category: "photo",
    description: "Reception area, first impression for campus visits.",
    tags: ["campus", "interior", "photo"],
  },
  {
    file: join(DOCS, "NEXIS CAMPUS PICTURES", "cafeteria.jpg"),
    name: "Campus — Cafeteria",
    category: "photo",
    description: "Student cafeteria.",
    tags: ["campus", "student-life", "photo"],
  },
  {
    file: join(DOCS, "NEXIS CAMPUS PICTURES", "waiting area.jpg"),
    name: "Campus — Waiting area",
    category: "photo",
    description: "Visitor waiting area.",
    tags: ["campus", "interior", "photo"],
  },
];

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
};

if (!URL_BASE || !SERVICE_KEY || !DB_PASSWORD || !REF) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

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

const db = await connect();

try {
  const { rows: admin } = await db.query(
    `select id from profiles where role = 'super_admin' order by created_at limit 1`
  );
  const uploader = admin[0]?.id ?? null;

  const { rows: existing } = await db.query(`select name from brand_assets`);
  const have = new Set(existing.map((r) => r.name));

  let added = 0;
  let missing = 0;

  for (const asset of ASSETS) {
    if (have.has(asset.name)) {
      console.log(`= ${asset.name}`);
      continue;
    }

    if (!existsSync(asset.file)) {
      console.log(`! ${asset.name} — source file not found, skipping`);
      console.log(`    ${asset.file}`);
      missing++;
      continue;
    }

    const ext = extname(asset.file).toLowerCase();
    const mime = MIME[ext] ?? "application/octet-stream";
    const bytes = readFileSync(asset.file);
    const size = statSync(asset.file).size;

    const safeName = basename(asset.file).replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${asset.category}/${safeName}`;

    process.stdout.write(`+ ${asset.name} (${(size / 1024).toFixed(0)} KB) ... `);

    const upload = await fetch(
      `${URL_BASE}/storage/v1/object/brand/${encodeURI(path)}`,
      {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": mime,
          "x-upsert": "true",
        },
        body: bytes,
      }
    );

    if (!upload.ok) {
      console.log("FAILED");
      console.log(`    ${await upload.text()}`);
      continue;
    }

    await db.query(
      `insert into brand_assets
         (name, description, category, file_path, file_size, mime_type, tags,
          is_pinned, uploaded_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        asset.name,
        asset.description,
        asset.category,
        path,
        size,
        mime,
        asset.tags,
        Boolean(asset.pinned),
        uploader,
      ]
    );

    console.log("ok");
    added++;
  }

  const { rows: counts } = await db.query(
    `select count(*) as assets, (select count(*) from brand_tokens) as tokens from brand_assets`
  );
  console.log(`\nadded ${added}${missing ? `, ${missing} source file(s) missing` : ""}`);
  console.log(`library now holds ${counts[0].assets} assets and ${counts[0].tokens} brand tokens`);
} finally {
  await db.end();
}
