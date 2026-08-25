import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "../components/ErrorBanner.jsx";

export default function PostActivity() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    type: "Walk",
    description: "",
    meet_point: "",
    starts_at: "",
    spots_total: 2,
    fee: 0,
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        setError(userError.message);
        return;
      }
      const { error } = await supabase.from("activities").insert({
        ...form,
        host_id: userData.user.id,
      });
      if (error) setError(error.message);
      else navigate("/");
    } catch (err) {
      setError(err.message || "Couldn't post this activity. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: "24px 20px" }}>
      <button
        onClick={() => navigate(-1)}
        className="mono"
        style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, marginBottom: 20, cursor: "pointer" }}
      >
        <ChevronLeft size={16} /> back
      </button>

      <h1 style={{ fontSize: 22, marginBottom: 20 }}>What are you up to?</h1>

      <form onSubmit={handleSubmit}>
        <input placeholder="Title" value={form.title} onChange={update("title")} required />

        <select value={form.type} onChange={update("type")}>
          <option>Walk</option>
          <option>Hike</option>
          <option>Food</option>
        </select>

        <textarea placeholder="Description" value={form.description} onChange={update("description")} rows={3} />

        <input placeholder="Meeting point (public place)" value={form.meet_point} onChange={update("meet_point")} required />

        <input type="datetime-local" value={form.starts_at} onChange={update("starts_at")} required />

        <label className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>Spots (max 3)</label>
        <input type="number" min={1} max={3} value={form.spots_total} onChange={update("spots_total")} />

        <label className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>Fee (£, 0 = free)</label>
        <input type="number" min={0} max={20} value={form.fee} onChange={update("fee")} />

        <ErrorBanner message={error} />
        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Posting…" : "Post activity"}
        </button>
      </form>
    </div>
  );
}
