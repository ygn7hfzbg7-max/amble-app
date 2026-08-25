import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "../components/ErrorBanner.jsx";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) setError(error.message);
      else setSent(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: "60px 24px" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>amble</h1>
      <p style={{ color: "var(--muted)", marginBottom: 32 }}>
        Join someone's Saturday.
      </p>

      {sent ? (
        <p>Check your email for a login link.</p>
      ) : (
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <ErrorBanner message={error} />
          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Sending…" : "Send login link"}
          </button>
        </form>
      )}
    </div>
  );
}
