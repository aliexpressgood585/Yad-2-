import { Resend } from "resend";

import { SITE } from "@/lib/site";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

type EmailInput = {
  to: string;
  subject: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

/**
 * שולח מייל דרך Resend. ללא מפתח API המייל נכתב ללוג בלבד,
 * כך שסביבת פיתוח עובדת בלי הגדרות נוספות.
 */
export async function sendEmail(input: EmailInput): Promise<{ sent: boolean }> {
  if (!resend) {
    console.info(`[email→${input.to}] ${input.subject}\n${input.body}`);
    return { sent: false };
  }

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? `${SITE.name} <noreply@example.com>`,
    to: input.to,
    subject: input.subject,
    html: renderEmail(input),
    text: `${input.heading}\n\n${input.body}${input.ctaUrl ? `\n\n${input.ctaUrl}` : ""}`,
  });

  if (error) {
    console.error("[email] Resend error", error);
    return { sent: false };
  }
  return { sent: true };
}

/** תבנית מייל RTL פשוטה — טבלאות ו-inline CSS לתאימות רחבה. */
function renderEmail({ heading, body, ctaLabel, ctaUrl }: EmailInput): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<!doctype html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f6f5f3;font-family:Arial,Helvetica,sans-serif;color:#1f1c19;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:20px 24px;background:#0f6d55;color:#ffffff;font-size:20px;font-weight:bold;">
        ${escape(SITE.name)}
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;">${escape(heading)}</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a443e;">${escape(body)}</p>
        ${
          ctaUrl && ctaLabel
            ? `<a href="${ctaUrl}" style="display:inline-block;padding:12px 24px;background:#0f6d55;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px;">${escape(ctaLabel)}</a>`
            : ""
        }
      </td>
    </tr>
    <tr>
      <td style="padding:16px 24px;background:#faf9f7;font-size:12px;color:#6b635b;">
        קיבלתם את המייל הזה כי יש לכם חשבון ב${escape(SITE.name)}.
        <a href="${SITE.url}/my/profile" style="color:#0f6d55;">ניהול העדפות ההתראות</a>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
