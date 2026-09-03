// Sends transactional email via Resend's HTTP API and wraps content in a
// simple branded shell matching the app's visual identity (styles.css):
// the "amble" wordmark in the brick accent colour, Space Grotesk for
// headings, Karla for body text.

const ACCENT = "#a8431f";
const INK = "#14150f";
const MUTED = "#7c7364";
const PAPER_DEEP = "#f5f1ec";
const BORDER = "#ece6db";

const FROM = process.env.RESEND_FROM_EMAIL || "Amble <notifications@amble.app>";

// Never throws — a failed or misconfigured send should never take down the
// action (accepting a request, posting a message, etc.) that triggered it.
// Callers just get { sent: false } back and can log/ignore it.
export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set — skipping email send.");
    return { sent: false, reason: "missing_api_key" };
  }
  if (!to) {
    console.error("sendEmail called with no recipient — skipping.");
    return { sent: false, reason: "missing_recipient" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`Resend API error ${res.status}: ${text}`);
      return { sent: false, reason: "resend_error", status: res.status };
    }
    return { sent: true };
  } catch (err) {
    console.error("Resend request failed:", err.message || err);
    return { sent: false, reason: "network_error" };
  }
}

// heading/body are plain text — escaped before being dropped into the HTML
// shell, since some inputs (activity titles, message previews) are
// user-authored.
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function emailShell({ preheader, heading, body, ctaLabel, ctaUrl }) {
  const safeHeading = escapeHtml(heading);
  const safeBody = escapeHtml(body);
  const safePreheader = escapeHtml(preheader || heading);
  const cta =
    ctaLabel && ctaUrl
      ? `<tr>
          <td style="padding:0 32px 32px;">
            <a href="${ctaUrl}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-family:'Space Grotesk',Helvetica,Arial,sans-serif;font-weight:700;font-size:14px;padding:12px 22px;border-radius:6px;">${escapeHtml(
              ctaLabel
            )}</a>
          </td>
        </tr>`
      : "";

  return `<!doctype html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;padding:0;background:${PAPER_DEEP};font-family:Karla,Helvetica,Arial,sans-serif;color:${INK};">
    <span style="display:none;font-size:1px;color:${PAPER_DEEP};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${safePreheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER_DEEP};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid ${BORDER};">
            <tr>
              <td style="padding:28px 32px 0;">
                <div style="font-family:'Space Grotesk',Helvetica,Arial,sans-serif;font-weight:700;font-size:22px;color:${ACCENT};">amble</div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 8px;">
                <h1 style="font-family:'Space Grotesk',Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;margin:0 0 12px;color:${INK};">${safeHeading}</h1>
                <p style="font-size:14px;line-height:1.5;color:${MUTED};margin:0 0 8px;">${safeBody}</p>
              </td>
            </tr>
            ${cta}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
