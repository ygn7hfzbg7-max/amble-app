import React from "react";
import { Check, ShieldCheck } from "lucide-react";

// Small pill badge shown next to a person's name — same tag-pill styling as
// the review tags on PublicProfile. Every tier gets a badge: 'basic' (the
// starting tier for everyone) gets a plain checkmark, 'verified' (basic + a
// track record) gets the stronger shield in the same moss color used
// elsewhere for trust signals.
const TIER_META = {
  basic: { label: "Basic", icon: Check, color: "var(--muted)" },
  verified: { label: "Verified", icon: ShieldCheck, color: "var(--moss)" },
};

export default function TierBadge({ tier, size = 11 }) {
  const meta = TIER_META[tier];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: size,
        fontWeight: 600,
        color: meta.color,
        border: `1px solid ${meta.color}`,
        borderRadius: 999,
        padding: "1px 7px",
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={size} />
      {meta.label}
    </span>
  );
}
