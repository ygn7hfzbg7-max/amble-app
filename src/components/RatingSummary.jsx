import React from "react";
import { Star } from "lucide-react";

// Small "★4.8 (12)" badge used on activity cards, the host card, and
// request lists. Falls back to "New to Amble" instead of a bare 0 rating
// when a person has no visible reviews yet.
export default function RatingSummary({ summary, size = 12 }) {
  if (!summary || summary.count === 0) {
    return (
      <span className="mono" style={{ fontSize: size, color: "var(--muted)", flexShrink: 0, whiteSpace: "nowrap" }}>
        New to Amble
      </span>
    );
  }
  return (
    <span
      className="mono"
      style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: size, color: "var(--muted)", flexShrink: 0, whiteSpace: "nowrap" }}
    >
      <Star size={size} color="var(--gold)" fill="var(--gold)" />
      {summary.average.toFixed(1)} ({summary.count})
    </span>
  );
}
