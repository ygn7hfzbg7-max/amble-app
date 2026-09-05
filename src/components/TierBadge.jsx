import React from "react";
import { ShieldCheck } from "lucide-react";

// Small pill badge shown next to a person's name once they've built a
// track record — same tag-pill styling as the review tags on
// PublicProfile. Deliberately renders nothing for 'basic', which is the
// default for almost everyone right now (everyone starts there): a badge
// on every single name would just be noise, so it only shows up once
// there's something to show.
const TIER_META = {
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
