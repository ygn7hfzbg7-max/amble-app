import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { TIER_LABELS } from "../lib/verification";

// Shown wherever gating actually blocks an action (posting or requesting to
// join a gated category) — explains why and links straight to the
// verification screen, instead of a bare error banner.
export default function VerificationNotice({ category, requiredTier, action = "Hosting" }) {
  const navigate = useNavigate();
  return (
    <div className="card" style={{ borderColor: "var(--gold)", background: "rgba(180, 144, 58, 0.08)" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
        <ShieldAlert size={18} color="var(--gold)" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 13, margin: 0 }}>
          {action} a {category} activity needs {TIER_LABELS[requiredTier]} verification — these can be more
          physically remote or isolating, so we ask for a bit more first.
        </p>
      </div>
      <button
        type="button"
        className="btn-secondary"
        style={{ width: "auto", padding: "8px 14px" }}
        onClick={() => navigate("/verification")}
      >
        Go to verification
      </button>
    </div>
  );
}
