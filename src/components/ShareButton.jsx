import React, { useState } from "react";
import { Share2, Check } from "lucide-react";
import { shareLink } from "../lib/share";

// Full-width/labelled by default (activity detail page); pass `iconOnly`
// for a compact circular button that fits on a card (e.g. My Plans).
export default function ShareButton({ title, text, url, iconOnly = false, className, style, onClick }) {
  const [copied, setCopied] = useState(false);

  const handleClick = async (e) => {
    onClick?.(e);
    const result = await shareLink({ title, text, url });
    if (result.copied) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={copied ? "Link copied" : "Share"}
        title={copied ? "Link copied" : "Share"}
        className={className}
        style={style}
      >
        {copied ? <Check size={14} /> : <Share2 size={14} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={className || "btn-secondary"}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, ...style }}
      onClick={handleClick}
    >
      {copied ? <Check size={16} /> : <Share2 size={16} />}
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
