// Absolute base URL for links inside emails. There's no request origin to
// read server-side (unlike the client, which uses window.location.origin),
// so this comes from an env var — PUBLIC_APP_URL if set, falling back to
// Vercel's automatic VERCEL_URL (a preview/production deployment host).
export function siteUrl() {
  const raw = process.env.PUBLIC_APP_URL || process.env.VERCEL_URL || "";
  if (!raw) return "";
  return raw.startsWith("http") ? raw.replace(/\/+$/, "") : `https://${raw.replace(/\/+$/, "")}`;
}
