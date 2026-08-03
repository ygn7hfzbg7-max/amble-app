import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, User } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ActivityCard from "../components/ActivityCard.jsx";

export default function Feed() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .order("starts_at", { ascending: true });
      if (!error) setActivities(data || []);
      setLoading(false);
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

      {loading && <p>Loading activities…</p>}
      {!loading && activities.length === 0 && (
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
