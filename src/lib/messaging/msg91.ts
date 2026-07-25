/**
 * MSG91 messaging adapter.
 *
 * Everything that sends a WhatsApp or SMS goes through `sendMessage`, so the
 * provider can be swapped by replacing this one file. In dry-run mode nothing
 * leaves the building — messages are logged so the flow can be exercised
 * safely before templates are approved.
 */

import type { ReminderChannel } from "@/lib/types";

const MSG91_BASE = "https://control.msg91.com/api";

export type SendResult = {
  ok: boolean;
  status: "sent" | "failed" | "dry_run" | "skipped";
  messageId?: string;
  error?: string;
  response?: unknown;
};

export type SendInput = {
  /** E.164 without a leading "+", e.g. 919733127000 */
  to: string;
  channel: ReminderChannel;
  /** Body for SMS and dry runs; also the fallback text for WhatsApp. */
  body?: string;
  /** Approved WhatsApp template name. Required for live WhatsApp sends. */
  template?: string;
  /** Ordered variables substituted into the template's body. */
  variables?: string[];
};

function config() {
  return {
    authKey: process.env.MSG91_AUTH_KEY ?? "",
    integratedNumber: process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER ?? "",
    senderId: process.env.MSG91_SENDER_ID ?? "",
    // Default to dry run: sending real messages must be an explicit choice.
    dryRun: process.env.MSG91_DRY_RUN !== "false",
  };
}

export function isConfigured() {
  return Boolean(config().authKey);
}

export async function sendMessage(input: SendInput): Promise<SendResult> {
  const { authKey, integratedNumber, senderId, dryRun } = config();

  if (input.channel === "in_app" || input.channel === "email") {
    return { ok: true, status: "skipped" };
  }

  if (!input.to) {
    return { ok: false, status: "failed", error: "No phone number on file" };
  }

  if (dryRun || !authKey) {
    console.info(
      `[msg91:dry-run] ${input.channel} → ${input.to}: ${input.body ?? input.template}`
    );
    return {
      ok: true,
      status: "dry_run",
      messageId: `dry-${Date.now()}`,
    };
  }

  try {
    const response =
      input.channel === "whatsapp"
        ? await sendWhatsApp(input, authKey, integratedNumber)
        : await sendSms(input, authKey, senderId);

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        status: "failed",
        error: `MSG91 returned ${response.status}`,
        response: body,
      };
    }

    // MSG91 signals application-level failures inside a 200 response.
    const type = (body as { type?: string })?.type;
    if (type === "error") {
      return {
        ok: false,
        status: "failed",
        error: (body as { message?: string })?.message ?? "MSG91 rejected the message",
        response: body,
      };
    }

    return {
      ok: true,
      status: "sent",
      messageId:
        (body as { request_id?: string })?.request_id ??
        (body as { messageId?: string })?.messageId,
      response: body,
    };
  } catch (error) {
    return {
      ok: false,
      status: "failed",
      error: error instanceof Error ? error.message : "Network error contacting MSG91",
    };
  }
}

function sendWhatsApp(input: SendInput, authKey: string, integratedNumber: string) {
  if (!input.template) {
    throw new Error(
      "WhatsApp sends require an approved template name — free-form text is only allowed inside a 24-hour customer service window."
    );
  }

  return fetch(`${MSG91_BASE}/v5/whatsapp/whatsapp-outbound-message/bulk/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", authkey: authKey },
    body: JSON.stringify({
      integrated_number: integratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: input.template,
          language: { code: "en", policy: "deterministic" },
          namespace: null,
          to_and_components: [
            {
              to: [input.to],
              components: {
                ...Object.fromEntries(
                  (input.variables ?? []).map((value, index) => [
                    `body_${index + 1}`,
                    { type: "text", value },
                  ])
                ),
              },
            },
          ],
        },
      },
    }),
  });
}

function sendSms(input: SendInput, authKey: string, senderId: string) {
  return fetch(`${MSG91_BASE}/v5/flow/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", authkey: authKey },
    body: JSON.stringify({
      sender: senderId,
      short_url: "0",
      mobiles: input.to,
      message: input.body ?? "",
    }),
  });
}
