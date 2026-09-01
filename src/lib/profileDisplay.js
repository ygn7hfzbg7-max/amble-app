// Central place for turning a profiles row into what's shown to other
// users — never falls back to email, since that would leak it as a
// user-facing label.
export function displayName(profile) {
  const name = profile?.display_name?.trim();
  return name || "Amble member";
}

export function memberSince(createdAt) {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
