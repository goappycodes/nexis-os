/**
 * Migration runner for Nexis OS.
 *
 * Applies every .sql file in supabase/migrations in filename order, tracking
 * what has already run in the _migrations table so re-runs are safe.
 *
 *   node scripts/db.mjs migrate     apply pending migrations
 *   node scripts/db.mjs status      show applied vs pending
 *   node scripts/db.mjs sql "..."   run a one-off statement
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
dotenv.config({ path: join(root, ".env.local") });

const MIGRATIONS_DIR = join(root, "supabase", "migrations");

const password = process.env.SUPABASE_DB_PASSWORD;
const ref = process.env.SUPABASE_PROJECT_REF;
if (!password || !ref) {
  console.error("Missing SUPABASE_DB_PASSWORD or SUPABASE_PROJECT_REF in .env.local");
  process.exit(1);
}

// Supabase's direct host is IPv6-only on newer projects; the session pooler is
// reachable over IPv4, so we prefer it and fall back to direct.
const candidates = [
  {
    label: "session pooler (ap-south-1)",
    host: `aws-0-ap-south-1.pooler.supabase.com`,
    port: 5432,
    user: `postgres.${ref}`,
  },
  {
    label: "session pooler (ap-south-1, aws-1)",
    host: `aws-1-ap-south-1.pooler.supabase.com`,
    port: 5432,
    user: `postgres.${ref}`,
  },
  {
    label: "direct",
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: "postgres",
  },
];

async function connect() {
  let lastErr;
  for (const c of candidates) {
    const client = new pg.Client({
      host: c.host,
      port: c.port,
      user: c.user,
      password,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
      statement_timeout: 120000,
    });
    try {
      await client.connect();
      console.log(`connected via ${c.label}`);
      return client;
    } catch (err) {
      lastErr = err;
      console.log(`  ${c.label} failed: ${err.message}`);
      try {
        await client.end();
      } catch {}
    }
  }
  throw lastErr;
}

const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 12);

function migrationFiles() {
  try {
    return readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch {
    return [];
  }
}

async function ensureTable(client) {
  await client.query(`
    create table if not exists public._migrations (
      name text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    );
  `);
}

async function migrate(client) {
  await ensureTable(client);
  const { rows } = await client.query("select name, checksum from public._migrations");
  const applied = new Map(rows.map((r) => [r.name, r.checksum]));

  const files = migrationFiles();
  if (!files.length) {
    console.log("no migration files found");
    return;
  }

  let ran = 0;
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const checksum = sha(sql);

    if (applied.has(file)) {
      if (applied.get(file) !== checksum) {
        console.log(`~ ${file} already applied but file has CHANGED since. Skipping.`);
        console.log(`  Write a new migration instead of editing an applied one.`);
      } else {
        console.log(`= ${file}`);
      }
      continue;
    }

    process.stdout.write(`+ ${file} ... `);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into public._migrations (name, checksum) values ($1, $2)", [
        file,
        checksum,
      ]);
      await client.query("commit");
      console.log("ok");
      ran++;
    } catch (err) {
      await client.query("rollback");
      console.log("FAILED");
      console.error(`\n${err.message}`);
      if (err.position) {
        const pos = parseInt(err.position, 10);
        const upto = sql.slice(0, pos);
        const line = upto.split("\n").length;
        console.error(`  at line ${line}: ${sql.split("\n")[line - 1]?.trim()}`);
      }
      process.exit(1);
    }
  }
  console.log(ran ? `\napplied ${ran} migration(s)` : "\nup to date");
}

async function status(client) {
  await ensureTable(client);
  const { rows } = await client.query(
    "select name, applied_at from public._migrations order by name"
  );
  const applied = new Set(rows.map((r) => r.name));
  console.log("\nmigrations:");
  for (const f of migrationFiles()) {
    console.log(`  ${applied.has(f) ? "[applied]" : "[pending]"} ${f}`);
  }
  const { rows: tables } = await client.query(`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `);
  console.log(`\npublic tables (${tables.length}):`);
  console.log(tables.map((t) => "  " + t.table_name).join("\n") || "  (none)");
}

const [, , cmd, arg] = process.argv;
const client = await connect();
try {
  if (cmd === "migrate") await migrate(client);
  else if (cmd === "status") await status(client);
  else if (cmd === "sql") {
    const res = await client.query(arg);
    console.table(res.rows);
  } else {
    console.log("usage: node scripts/db.mjs <migrate|status|sql>");
  }
} finally {
  await client.end();
}
