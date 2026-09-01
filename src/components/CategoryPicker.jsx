import React from "react";
import { CATEGORIES } from "../lib/categories";

export default function CategoryPicker({ value, onChange }) {
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
        return (
          <button
            key={catValue}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(catValue)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 6px",
              borderRadius: 10,
              border: `1px solid ${selected ? color : "var(--paper-deep)"}`,
              background: selected ? color : "var(--white)",
              color: selected ? "var(--white)" : "var(--ink)",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
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
