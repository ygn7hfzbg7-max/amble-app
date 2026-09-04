import React from "react";
import { Lock } from "lucide-react";
import { CATEGORIES } from "../lib/categories";
import { requiredTierFor, meetsTier } from "../lib/verification";

// `userTier` is optional — when passed, categories the current user doesn't
// yet qualify for (e.g. Sport/Outdoors before phone verification) get a
// small lock hint. Selecting one is still allowed here; the actual block
// happens on submit, with a link to the verification screen.
export default function CategoryPicker({ value, onChange, userTier }) {
  return (
    <div
      role="radiogroup"
      aria-label="Category"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
        gap: 8,
        marginBottom: 14,
      }}
    >
      {CATEGORIES.map(({ value: catValue, icon: Icon, color }) => {
        const selected = value === catValue;
        const required = requiredTierFor(catValue);
        const gated = required && userTier != null && !meetsTier(userTier, required);
        return (
          <button
            key={catValue}
            type="button"
            role="radio"
            aria-checked={selected}
            title={gated ? `Requires ${required} verification` : undefined}
            onClick={() => onChange(catValue)}
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 6px",
              borderRadius: 10,
              border: `1px solid ${selected ? color : "var(--border)"}`,
              background: selected ? color : "var(--paper-deep)",
              color: selected ? "var(--white)" : "var(--ink)",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            {gated && (
              <Lock
                size={11}
                style={{ position: "absolute", top: 6, right: 6, color: selected ? "var(--white)" : "var(--muted)" }}
              />
            )}
            <Icon size={18} />
            <span className="mono" style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2 }}>
              {catValue}
            </span>
          </button>
        );
      })}
    </div>
  );
}
