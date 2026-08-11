import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "../components/ErrorBanner.jsx";

export default function EditProfile() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ display_name: "", city: "", bio: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          setError(userError.message);
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("display_name, city, bio")
          .eq("id", userData.user.id)
          .single();
        if (error) setError(error.message);
        else if (data) setForm({ display_name: data.display_name || "", city: data.city || "", bio: data.bio || "" });
      } catch (err) {
        setError(err.message || "Couldn't load your profile. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        setError(userError.message);
        return;
      }
      const { error } = await supabase
        .from("profiles")
        .update(form)
        .eq("id", userData.user.id);
      if (error) setError(error.message);
      else navigate("/profile");
    } catch (err) {
      setError(err.message || "Couldn't save your profile. Please try again.");
    } finally {
      setSaving(false);
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

      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Edit profile</h1>

      <form onSubmit={handleSubmit}>
        <label className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>Display name</label>
        <input
          placeholder="What should hosts and travellers call you?"
          value={form.display_name}
          onChange={update("display_name")}
        />

        <label className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>City</label>
        <input placeholder="City" value={form.city} onChange={update("city")} />

        <label className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>Bio</label>
        <textarea placeholder="A short intro" value={form.bio} onChange={update("bio")} rows={3} />

        <ErrorBanner message={error} />
        <button className="btn-primary" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>
    </div>
  );
}
