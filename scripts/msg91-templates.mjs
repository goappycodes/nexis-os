/**
 * Create (or list) the WhatsApp templates Nexis OS sends.
 *
 *   node scripts/msg91-templates.mjs list      show every template on the account
 *   node scripts/msg91-templates.mjs create    submit the Nexis OS templates
 *
 * Templates go to Meta for approval and usually clear within minutes to a few
 * hours. They are all UTILITY: operational notices to staff who have opted in,
 * not marketing.
 *
 * WhatsApp template rules worth remembering when editing these:
 *   - a body may not start or end with a variable
 *   - two variables may not sit next to each other
 *   - every variable needs a sample value or Meta rejects the submission
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const AUTH_KEY = process.env.MSG91_AUTH_KEY;
const NUMBER = process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER;
const BASE = "https://api.msg91.com/api/v5/whatsapp";

if (!AUTH_KEY || !NUMBER) {
  console.error("Set MSG91_AUTH_KEY and MSG91_WHATSAPP_INTEGRATED_NUMBER in .env.local");
  process.exit(1);
}

const headers = { authkey: AUTH_KEY, "Content-Type": "application/json" };

/** body() builds a Meta BODY component with its required sample values. */
const body = (text, samples) => ({
  type: "BODY",
  text,
  example: { body_text: [samples] },
});

const FOOTER = { type: "FOOTER", text: "Nexis OS · NEXIS School of Business" };

export const TEMPLATES = [
  {
    name: "nexisos_task_reminder",
    category: "UTILITY",
    components: [
      body(
        "Hi {{1}}, a task is due soon on Nexis OS.\n\n*{{2}}*\nDue: {{3}}\n\nOpen Nexis OS to mark it done or add a comment.",
        ["Ritesh", "Confirm venue and block the date", "18 Aug 2026"]
      ),
      FOOTER,
    ],
  },
  {
    name: "nexisos_meeting_invite",
    category: "UTILITY",
    components: [
      body(
        "Hi {{1}}, you have been invited to a meeting on Nexis OS.\n\n*{{2}}*\nWhen: {{3}}\nWhere: {{4}}\nCalled by: {{5}}\n\nOpen Nexis OS to accept or decline.",
        ["Ritesh", "Marketing weekly review", "28 Jul 2026, 11:00 am", "Apex Hall", "Ananya"]
      ),
      FOOTER,
    ],
  },
  {
    // Escalation for overdue or urgent-priority work. Kept visually distinct
    // from the routine reminder so it does not blend into the noise.
    name: "nexisos_task_urgent",
    category: "UTILITY",
    components: [
      body(
        "Hi {{1}}, this task needs attention today.\n\n*{{2}}*\nDue: {{3}}\nStatus: {{4}}\n\nOpen Nexis OS to update it or flag a blocker.",
        ["Ritesh", "Send printables to press", "2 Sept 2026", "Overdue by 3 days"]
      ),
      FOOTER,
    ],
  },
  {
    name: "nexisos_task_assigned",
    category: "UTILITY",
    components: [
      body(
        "Hi {{1}}, you have a new task on Nexis OS.\n\n*{{2}}*\nDue: {{3}}\nAssigned by: {{4}}\n\nOpen Nexis OS to see the details.",
        ["Ritesh", "Design event creative set", "25 Aug 2026", "Priya"]
      ),
      FOOTER,
    ],
  },
  {
    name: "nexisos_approval_pending",
    category: "UTILITY",
    components: [
      body(
        "Hi {{1}}, something is waiting for your approval on Nexis OS.\n\n*{{2}}*\nSubmitted by: {{3}}\nType: {{4}}\n\nOpen Nexis OS to approve or request changes.",
        ["Ritesh", "Open House announcement poster", "Priya", "Creative"]
      ),
      FOOTER,
    ],
  },
  {
    name: "nexisos_approval_decision",
    category: "UTILITY",
    components: [
      body(
        "Hi {{1}}, your submission on Nexis OS has been reviewed.\n\n*{{2}}*\nDecision: {{3}}\nReviewed by: {{4}}\n\nOpen Nexis OS to see the comments.",
        ["Priya", "Open House announcement poster", "Approved", "Ritesh"]
      ),
      FOOTER,
    ],
  },
  {
    name: "nexisos_event_countdown",
    category: "UTILITY",
    components: [
      body(
        "Hi {{1}}, an event is coming up on Nexis OS.\n\n*{{2}}*\nWhen: {{3}}\nVenue: {{4}}\nOpen checklist items: {{5}}\n\nOpen Nexis OS to see what is still pending.",
        ["Ritesh", "Nexis Open House 2026", "12 Sept 2026, 10:00 am", "Apex Hall", "7"]
      ),
      FOOTER,
    ],
  },
];

async function listTemplates() {
  const res = await fetch(`${BASE}/get-template/${NUMBER}/`, { headers });
  const json = await res.json();
  return json?.data ?? [];
}

async function list() {
  const templates = await listTemplates();
  console.log(`\n${templates.length} template(s) on ${NUMBER}:\n`);
  for (const t of templates) {
    for (const lang of t.languages ?? []) {
      console.log(
        `  ${String(t.category).padEnd(15)} ${String(lang.status).padEnd(10)} ${t.name}`
      );
    }
  }
}

async function create() {
  const existing = await listTemplates();
  const existingNames = new Set(existing.map((t) => t.name));

  for (const template of TEMPLATES) {
    if (existingNames.has(template.name)) {
      console.log(`= ${template.name} already exists, skipping`);
      continue;
    }

    process.stdout.write(`+ ${template.name} ... `);

    const res = await fetch(`${BASE}/client-panel-template/`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        integrated_number: NUMBER,
        template_name: template.name,
        language: "en",
        category: template.category,
        components: template.components,
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (json?.hasError || json?.status === "fail" || json?.status === "error") {
      console.log("FAILED");
      console.log(`  ${JSON.stringify(json.errors ?? json)}`);
    } else {
      console.log(`ok (${json?.data?.status ?? "submitted"})`);
    }
  }

  console.log("\nTemplates are submitted to Meta for approval.");
  console.log("Run `node scripts/msg91-templates.mjs list` to check their status.");
}

const cmd = process.argv[2] ?? "list";
if (cmd === "create") await create();
else await list();
