// Verification tier system, layer 1 — tier constants and the category
// gating map. Keep required_tier_for_category / tier_meets in
// supabase/migrations/0003_verification_tier.sql in sync with
// CATEGORY_MIN_TIER / meetsTier here: the client checks below are what
// actually stop someone in the UI, the SQL triggers are belt-and-braces.

export const TIER_RANK = { unverified: 0, basic: 1, verified: 2 };

export const TIER_LABELS = {
  unverified: "Unverified",
  basic: "Basic",
  verified: "Verified",
};

// "Verified" track record: 2+ activities with a decent (4-5 star), visible
// review. Mirrored server-side in count_verified_track_record() /
// refresh_verification_tier().
export const VERIFIED_TRACK_RECORD_THRESHOLD = 2;
export const VERIFIED_DECENT_RATING = 4;

// Only categories where things get more physically remote or isolating
// require anything beyond email — everything else stays open to a
// brand-new, unverified sign-up.
export const CATEGORY_MIN_TIER = {
  Sport: "basic",
  Outdoors: "basic",
};

export function requiredTierFor(category) {
  return CATEGORY_MIN_TIER[category] || null;
}

export function meetsTier(userTier, requiredTier) {
  if (!requiredTier) return true;
  return (TIER_RANK[userTier] ?? 0) >= (TIER_RANK[requiredTier] ?? 0);
}

// +<countrycode><number>, digits only after the leading +. Supabase phone
// auth (and the SMS providers behind it) expects E.164.
const E164 = /^\+[1-9]\d{7,14}$/;

export function normalizePhone(input) {
  const trimmed = (input || "").trim().replace(/[\s().-]/g, "");
  return trimmed;
}

export function isValidPhone(input) {
  return E164.test(normalizePhone(input));
}

// The gating triggers in supabase/migrations/0003_verification_tier.sql
// prefix their exception message with this so a raw Postgres error message
// never has to be shown verbatim — this is only a defense-in-depth path,
// since the UI already blocks the action before it reaches the database.
const VERIFICATION_ERROR_PREFIX = "VERIFICATION_REQUIRED:";

export function friendlyVerificationError(message) {
  if (typeof message !== "string" || !message.includes(VERIFICATION_ERROR_PREFIX)) return message;
  return message.slice(message.indexOf(VERIFICATION_ERROR_PREFIX) + VERIFICATION_ERROR_PREFIX.length).trim();
}
