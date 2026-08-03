import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) setError(error.message);
    else setSent(true);
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
          {error && (
            <p style={{ color: "var(--brick)", fontSize: 13, marginBottom: 12 }}>
              {error}
            </p>
          )}
          <button className="btn-primary" type="submit">
            Send login link
          </button>
        </form>
      )}
    </div>
  );
}
