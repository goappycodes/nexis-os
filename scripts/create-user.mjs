/**
 * Provision a Nexis OS user.
 *
 *   node scripts/create-user.mjs <email> <"Full Name"> <role> [phone] [password]
 *
 * role: super_admin | manager | member
 * If no password is given, a strong one is generated and printed once.
 *
 * Uses the service-role key, so it works before anyone can sign in — this is
 * how the first super admin gets created.
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const [, , email, fullName, role = "member", phone = "", passwordArg] = process.argv;

if (!email || !fullName) {
  console.error('usage: node scripts/create-user.mjs <email> "<Full Name>" <role> [phone] [password]');
  process.exit(1);
}

if (!["super_admin", "manager", "member"].includes(role)) {
  console.error(`invalid role "${role}" — use super_admin, manager or member`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

/** Readable but strong: 18 chars of base64url. */
const password = passwordArg || randomBytes(14).toString("base64url");

const headers = {
  "Content-Type": "application/json",
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
};

// 1. Create the auth user. email_confirm skips the verification mail — the
//    super admin is vouching for this person by creating them.
const createRes = await fetch(`${url}/auth/v1/admin/users`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone },
  }),
});

const created = await createRes.json();

let userId = created?.id;

if (!createRes.ok) {
  const msg = created?.msg || created?.message || JSON.stringify(created);
  if (!/already/i.test(msg)) {
    console.error(`Failed to create user: ${msg}`);
    process.exit(1);
  }
  // Already exists — look them up so we can still fix up their profile/role.
  console.log("user already exists, updating profile instead");
  const listRes = await fetch(
    `${url}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
    { headers }
  );
  const list = await listRes.json();
  userId = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
  if (!userId) {
    console.error("could not resolve existing user id");
    process.exit(1);
  }
}

// 2. The handle_new_user trigger already inserted a profile row; set the
//    fields it can't know (role, phone, name) via PostgREST.
const patchRes = await fetch(`${url}/rest/v1/profiles?id=eq.${userId}`, {
  method: "PATCH",
  headers: { ...headers, Prefer: "return=representation" },
  body: JSON.stringify({
    full_name: fullName,
    role,
    phone: phone || null,
    email,
    is_active: true,
  }),
});

if (!patchRes.ok) {
  console.error(`Failed to update profile: ${await patchRes.text()}`);
  process.exit(1);
}

console.log("\n──────────────────────────────────────────────");
console.log(` user created`);
console.log(`  email    ${email}`);
console.log(`  name     ${fullName}`);
console.log(`  role     ${role}`);
if (phone) console.log(`  phone    ${phone}`);
if (!passwordArg) {
  console.log(`  password ${password}`);
  console.log("\n  Save this now — it is not stored anywhere and");
  console.log("  will not be shown again. Change it after first sign-in.");
}
console.log("──────────────────────────────────────────────\n");
