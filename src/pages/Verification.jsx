import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ShieldCheck, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "../components/ErrorBanner.jsx";
import { TIER_LABELS, VERIFIED_TRACK_RECORD_THRESHOLD } from "../lib/verification";

const TIER_BLURB = {
  basic: "You're set to browse, host, and join activities.",
  verified: "You're fully verified for what Amble checks today.",
};

export default function Verification() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_my_verification_status");
        if (error) throw error;
        setStatus(Array.isArray(data) ? data[0] : data);
      } catch (err) {
        setLoadError(err.message || "Couldn't load your verification status. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;

  return (
    <div style={{ padding: "24px 20px" }}>
      <button
        onClick={() => navigate(-1)}
        className="mono"
        style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, marginBottom: 20, cursor: "pointer" }}
      >
        <ChevronLeft size={16} /> back
      </button>

      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Verification</h1>

      <ErrorBanner message={loadError} />

      {status && (
        <>
          <div className="card" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <ShieldCheck size={22} color="var(--moss)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>
                Your tier
              </div>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>
                {TIER_LABELS[status.verification_tier] || "Basic"}
              </div>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                {TIER_BLURB[status.verification_tier] || TIER_BLURB.basic}
              </p>
            </div>
          </div>

          {status.verification_tier === "basic" && (
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>On your way to Verified</div>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
                Complete {VERIFIED_TRACK_RECORD_THRESHOLD} activities with visible, good reviews and you'll be
                upgraded to Verified automatically — no extra steps.
              </p>
              <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--moss)" }}>
                {Math.min(status.track_record_count, status.track_record_threshold)} of {status.track_record_threshold}{" "}
                completed
              </div>
            </div>
          )}

          {status.verification_tier === "verified" && (
            <div className="card" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <CheckCircle2 size={18} color="var(--moss)" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                ID verification and live location sharing are coming in a later update — there's nothing more to do
                here for now.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
