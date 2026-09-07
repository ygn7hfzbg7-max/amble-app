import React, { useState } from "react";
import { Flag, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "./ErrorBanner.jsx";
import { REPORT_REASONS } from "../lib/reports";

// Report/flag form for an active match (accepted request) — see the
// `reports` table in supabase/migrations/0004_reports.sql. Write-only from
// here: there's no way to view submitted reports in the app, by design.
export default function ReportPanel({ activityId, reporterId, reportedUserId, onClose }) {
  const [reason, setReason] = useState(REPORT_REASONS[0].value);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { error: insertError } = await supabase.from("reports").insert({
        activity_id: activityId,
        reporter_id: reporterId,
        reported_user_id: reportedUserId,
        reason,
        details: details.trim() || null,
      });
      if (insertError) {
        setError(insertError.message);
        return;
      }
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Couldn't submit your report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="card" style={{ borderColor: "var(--moss)" }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--moss)", marginBottom: 12 }}>
          Thanks — we've received your report.
        </p>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Flag size={17} color="var(--brick)" />
          <h2 style={{ fontSize: 15, margin: 0 }}>Report a concern</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0, display: "flex" }}
        >
          <X size={18} />
        </button>
      </div>

      <ErrorBanner message={error} />

      <form onSubmit={handleSubmit}>
        <label className="mono" htmlFor="report-reason" style={{ fontSize: 12, color: "var(--muted)" }}>
          Reason
        </label>
        <select id="report-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
          {REPORT_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <label className="mono" htmlFor="report-details" style={{ fontSize: 12, color: "var(--muted)" }}>
          Details (optional)
        </label>
        <textarea
          id="report-details"
          rows={3}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Anything else that would help us understand what happened"
          style={{ resize: "vertical" }}
        />

        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit report"}
        </button>
      </form>
    </div>
  );
}
