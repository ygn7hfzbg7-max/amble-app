// Shares a link via the OS share sheet (navigator.share) where available —
// WhatsApp, iMessage, Mail, etc. show up there for free on iOS/Android.
// Falls back to copying the URL to the clipboard on desktop/unsupported
// browsers, or if the user's browser exposes navigator.share but rejects
// this particular payload.
export async function shareLink({ title, text, url }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return { shared: true };
    } catch (err) {
      if (err?.name === "AbortError") return { shared: false, cancelled: true };
      // Some browsers advertise navigator.share but throw on it (e.g. no
      // permission in an iframe) — fall through to the clipboard copy.
    }
  }

  try {
    await copyToClipboard(url);
    return { shared: false, copied: true };
  } catch (err) {
    return { shared: false, copied: false, error: err };
  }
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Clipboard API isn't available (non-HTTPS context, older browser) —
  // fall back to the classic hidden-textarea + execCommand trick.
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}
