import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, User } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ActivityCard from "../components/ActivityCard.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";

export default function Feed() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("activities")
          .select("*")
          .order("starts_at", { ascending: true });
        if (error) setError(error.message);
        else setActivities(data || []);
      } catch (err) {
        setError(err.message || "Couldn't load activities. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div style={{ padding: "24px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22 }}>amble</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn-secondary"
            style={{ width: "auto", padding: 10 }}
            onClick={() => navigate("/post")}
          >
            <Plus size={16} />
          </button>
          <button
            className="btn-secondary"
            style={{ width: "auto", padding: 10 }}
            onClick={() => navigate("/profile")}
          >
            <User size={16} />
          </button>
        </div>
      </div>

      <ErrorBanner message={error} />
      {loading && <p>Loading activities…</p>}
      {!loading && !error && activities.length === 0 && (
        <p style={{ color: "var(--muted)" }}>
          No activities yet — be the first to post one.
        </p>
      )}
      {activities.map((a) => (
        <ActivityCard key={a.id} activity={a} />
      ))}
    </div>
  );
}
