import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, User, ClipboardList } from "lucide-react";
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
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          setError(userError.message);
          return;
        }
        const userId = userData.user.id;

        const { data, error } = await supabase
          .from("activities")
          .select("*")
          .gte("starts_at", new Date().toISOString())
          .neq("host_id", userId)
          .order("starts_at", { ascending: true });
        if (error) {
          setError(error.message);
          return;
        }

        const upcoming = data || [];
        const ids = upcoming.map((a) => a.id);
        const acceptedCounts = {};
        if (ids.length > 0) {
          const { data: accepted, error: acceptedError } = await supabase
            .from("requests")
            .select("activity_id")
            .in("activity_id", ids)
            .eq("status", "accepted");
          if (acceptedError) {
            setError(acceptedError.message);
            return;
          }
          for (const r of accepted || []) {
            acceptedCounts[r.activity_id] = (acceptedCounts[r.activity_id] || 0) + 1;
          }
        }

        const joinable = upcoming
          .map((a) => ({ ...a, spotsTaken: acceptedCounts[a.id] || 0 }))
          .filter((a) => a.spotsTaken < a.spots_total);

        setActivities(joinable);
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
            onClick={() => navigate("/my-plans")}
          >
            <ClipboardList size={16} />
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
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <p style={{ color: "var(--muted)", marginBottom: 20 }}>
            No upcoming activities yet — be the first to get something going.
          </p>
          <button className="btn-primary" onClick={() => navigate("/post")}>
            Post an activity
          </button>
        </div>
      )}
      {activities.map((a) => (
        <ActivityCard key={a.id} activity={a} spotsLeft={a.spots_total - a.spotsTaken} />
      ))}
    </div>
  );
}
