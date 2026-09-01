import React from "react";

// Same accent colors used elsewhere in the app (moss/brick/gold/muted), so a
// fallback avatar always fits the palette.
const PALETTE = ["#3c6e58", "#b84b2c", "#b4903a", "#756b58"];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function initials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// `seed` should be something stable per-person (user id) so the same person
// always gets the same fallback color; falls back to `name` if no id is handy.
export default function Avatar({ src, name, seed, size = 40, style }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name ? `${name}'s profile photo` : "Profile photo"}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          border: "1px solid var(--paper-deep)",
          ...style,
        }}
      />
    );
  }

  const bg = PALETTE[hashString(seed || name || "?") % PALETTE.length];
  return (
    <div
      className="mono"
      aria-label={name ? `${name}'s profile photo` : "Profile photo"}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        color: "var(--white)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: Math.max(Math.round(size * 0.38), 10),
        flexShrink: 0,
        ...style,
      }}
    >
      {initials(name)}
    </div>
  );
}
