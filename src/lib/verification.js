// Verification tier system, layer 1 — tier constants and the category
// gating map. Keep required_tier_for_category / tier_meets in
// supabase/migrations/0003_verification_tier.sql in sync with
// CATEGORY_MIN_TIER / meetsTier here: the client checks below are what
// actually stop someone in the UI, the SQL triggers are belt-and-braces.
//
// 'basic' is the starting tier for everyone — the existing magic-link
// login already proves email ownership, so there's no separate
// "unverified" state below it and no phone/SMS step in this layer.
// 'verified' is basic + a track record, upgraded automatically. A tier
// above 'verified' (e.g. ID verification) may show up later; TIER_RANK is
// written so adding one is additive rather than a rework.

export const TIER_RANK = { basic: 0, verified: 1 };

export const TIER_LABELS = {
  basic: "Basic",
  verified: "Verified",
};

// "Verified" track record: 2+ activities with a decent (4-5 star), visible
// review. Mirrored server-side in count_verified_track_record() /
// refresh_verification_tier().
export const VERIFIED_TRACK_RECORD_THRESHOLD = 2;
export const VERIFIED_DECENT_RATING = 4;

// A no-op today, since every sign-up already starts at 'basic' — kept as
// future-proofing for a tier introduced below 'basic' later, or a category
// that ends up needing 'verified' specifically.
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

// The gating triggers in supabase/migrations/0003_verification_tier.sql
// prefix their exception message with this so a raw Postgres error message
// never has to be shown verbatim — this is only a defense-in-depth path,
// since the UI already blocks the action before it reaches the database.
const VERIFICATION_ERROR_PREFIX = "VERIFICATION_REQUIRED:";

export function friendlyVerificationError(message) {
  if (typeof message !== "string" || !message.includes(VERIFICATION_ERROR_PREFIX)) return message;
  return message.slice(message.indexOf(VERIFICATION_ERROR_PREFIX) + VERIFICATION_ERROR_PREFIX.length).trim();
}
