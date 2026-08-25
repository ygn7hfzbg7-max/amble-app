import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "../components/ErrorBanner.jsx";

export default function MyActivities() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [pendingCounts, setPendingCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          setError(userError.message);
          return;
        }

        const { data: myActivities, error: activitiesError } = await supabase
          .from("activities")
          .select("*")
          .eq("host_id", userData.user.id)
          .order("starts_at", { ascending: true });
        if (activitiesError) {
          setError(activitiesError.message);
          return;
        }
        setActivities(myActivities || []);

        const activityIds = (myActivities || []).map((a) => a.id);
        if (activityIds.length > 0) {
          const { data: pending, error: pendingError } = await supabase
            .from("requests")
            .select("activity_id")
            .in("activity_id", activityIds)
            .eq("status", "pending");
          if (pendingError) {
            setError(pendingError.message);
            return;
          }
          const counts = {};
          for (const r of pending || []) {
            counts[r.activity_id] = (counts[r.activity_id] || 0) + 1;
          }
          setPendingCounts(counts);
        }
      } catch (err) {
        setError(err.message || "Couldn't load your activities. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div style={{ padding: "24px 20px" }}>
      <button
        onClick={() => navigate(-1)}
        className="mono"
        style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, marginBottom: 20, cursor: "pointer" }}
      >
        <ChevronLeft size={16} /> back
      </button>

      <h1 style={{ fontSize: 22, marginBottom: 20 }}>My activities</h1>

      <ErrorBanner message={error} />
      {loading && <p>Loading…</p>}
      {!loading && !error && activities.length === 0 && (
        <p style={{ color: "var(--muted)" }}>
          You haven't posted an activity yet.
        </p>
      )}
      {activities.map((a) => {
        const pending = pendingCounts[a.id] || 0;
        return (
          <div
            key={a.id}
            className="card"
            style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
            onClick={() => navigate(`/activity/${a.id}/requests`)}
          >
            <div>
              <h3 style={{ fontSize: 16, marginBottom: 6 }}>{a.title}</h3>
              <div className="mono" style={{ color: "var(--muted)", fontSize: 12 }}>
                {new Date(a.starts_at).toLocaleString()}
              </div>
            </div>
            {pending > 0 && (
              <span
                className="mono"
                style={{
                  background: "var(--brick)",
                  color: "var(--white)",
                  borderRadius: 999,
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {pending} pending
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
