import React from "react";
import { ShieldCheck, Phone } from "lucide-react";

// Small pill badge shown next to a person's name once they've verified
// something — same tag-pill styling as the review tags on PublicProfile.
// Deliberately renders nothing for 'unverified', which is the default for
// almost everyone right now: a badge on every single name would just be
// noise, so it only shows up once there's something to show.
const TIER_META = {
  basic: { label: "Phone verified", icon: Phone, color: "var(--moss)" },
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
