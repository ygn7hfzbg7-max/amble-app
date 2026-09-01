import React from "react";
import { Star } from "lucide-react";

// Interactive when onChange is passed, otherwise a plain read-only display
// (used both on the submission form and to render a saved/locked review).
export default function StarRating({ value = 0, onChange, size = 24 }) {
  const stars = [1, 2, 3, 4, 5];
  const readOnly = !onChange;
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {stars.map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange && onChange(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            display: "flex",
            cursor: readOnly ? "default" : "pointer",
          }}
        >
          <Star size={size} color="var(--gold)" fill={n <= value ? "var(--gold)" : "none"} />
        </button>
      ))}
    </div>
  );
}
