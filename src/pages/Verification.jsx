import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ShieldCheck, Phone, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "../components/ErrorBanner.jsx";
import {
  TIER_LABELS,
  VERIFIED_TRACK_RECORD_THRESHOLD,
  isValidPhone,
  normalizePhone,
} from "../lib/verification";

const TIER_BLURB = {
  unverified: "You've confirmed your email — that's enough to browse and join most activities.",
  basic: "Your phone is confirmed. Sport and Outdoors activities are open to you now.",
  verified: "You're fully verified for what Amble checks today.",
};

export default function Verification() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [step, setStep] = useState("phone"); // phone | code
  const [phoneInput, setPhoneInput] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [formError, setFormError] = useState("");

  const loadStatus = async () => {
    const { data, error } = await supabase.rpc("get_my_verification_status");
    if (error) throw error;
    setStatus(Array.isArray(data) ? data[0] : data);
  };

  useEffect(() => {
    (async () => {
      try {
        await loadStatus();
      } catch (err) {
        setLoadError(err.message || "Couldn't load your verification status. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSendCode = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!isValidPhone(phoneInput)) {
      setFormError("Enter your number in international format, including the country code — e.g. +14155552671.");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.auth.updateUser({ phone: normalizePhone(phoneInput) });
      if (error) setFormError(error.message);
      else setStep("code");
    } catch (err) {
      setFormError(err.message || "Couldn't send a code. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!code.trim()) {
      setFormError("Enter the code we texted you.");
      return;
    }
    setVerifying(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: normalizePhone(phoneInput),
        token: code.trim(),
        type: "phone_change",
      });
      if (verifyError) {
        setFormError(verifyError.message);
        return;
      }
      const { error: confirmError } = await supabase.rpc("confirm_phone_verification");
      if (confirmError) {
        setFormError(confirmError.message);
        return;
      }
      await loadStatus();
      setStep("phone");
      setPhoneInput("");
      setCode("");
    } catch (err) {
      setFormError(err.message || "Couldn't verify that code. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

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
                {TIER_LABELS[status.verification_tier] || "Unverified"}
              </div>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                {TIER_BLURB[status.verification_tier] || TIER_BLURB.unverified}
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

          <h2 className="day-heading" style={{ fontSize: 15, marginTop: 8 }}>Phone verification</h2>

          {status.phone_verified_at ? (
            <div className="card" style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Phone size={18} color="var(--moss)" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: 14 }}>
                <div style={{ fontWeight: 600 }}>{status.phone}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>Verified</div>
              </div>
            </div>
          ) : (
            <div className="card">
              {step === "phone" ? (
                <form onSubmit={handleSendCode}>
                  <label className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                    Phone number
                  </label>
                  <input
                    type="tel"
                    placeholder="+14155552671"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                  />
                  <p className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: -8, marginBottom: 14 }}>
                    Include your country code — we'll text you a one-time code.
                  </p>
                  <ErrorBanner message={formError} />
                  <button className="btn-primary" type="submit" disabled={sending}>
                    {sending ? "Sending…" : "Send code"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyCode}>
                  <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
                    Enter the code we texted to {normalizePhone(phoneInput)}.
                  </p>
                  <label className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                    Verification code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  <ErrorBanner message={formError} />
                  <button className="btn-primary" type="submit" disabled={verifying}>
                    {verifying ? "Verifying…" : "Verify code"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ marginTop: 10 }}
                    onClick={() => {
                      setStep("phone");
                      setCode("");
                      setFormError("");
                    }}
                  >
                    Use a different number
                  </button>
                </form>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
