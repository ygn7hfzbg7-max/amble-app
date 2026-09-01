import {
  UtensilsCrossed,
  Footprints,
  Mountain,
  Landmark,
  Trophy,
  Music,
  Sparkles,
} from "lucide-react";

export const CATEGORIES = [
  { value: "Food & drink", icon: UtensilsCrossed, color: "var(--brick)" },
  { value: "Walk", icon: Footprints, color: "var(--moss)" },
  { value: "Outdoors", icon: Mountain, color: "var(--moss)" },
  { value: "Culture", icon: Landmark, color: "var(--gold)" },
  { value: "Sport", icon: Trophy, color: "var(--brick)" },
  { value: "Nightlife", icon: Music, color: "var(--gold)" },
  { value: "Something else", icon: Sparkles, color: "var(--muted)" },
];

const CATEGORY_MAP = new Map(CATEGORIES.map((c) => [c.value, c]));

const FALLBACK_ICON = Sparkles;
const FALLBACK_COLOR = "var(--muted)";
const FALLBACK_LABEL = "Something else";

// Falls back to a neutral "Something else" look for null/unrecognised
// types (e.g. legacy data) instead of crashing, while still showing the
// raw value if one was set.
export function getCategory(type) {
  const known = type ? CATEGORY_MAP.get(type) : null;
  if (known) return known;
  return { value: type || FALLBACK_LABEL, icon: FALLBACK_ICON, color: FALLBACK_COLOR };
}
