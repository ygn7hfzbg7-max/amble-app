import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "../components/ErrorBanner.jsx";

export default function PendingRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          setError(userError.message);
          return;
        }

        const { data: hostedActivities, error: hostedError } = await supabase
          .from("activities")
          .select("id")
          .eq("host_id", userData.user.id);
        if (hostedError) {
          setError(hostedError.message);
          return;
        }

        const hostedIds = (hostedActivities || []).map((a) => a.id);
        if (hostedIds.length === 0) {
          setRequests([]);
          return;
        }

        const { data, error: requestsError } = await supabase
          .from("requests")
          .select("*, profiles(display_name, email, city, bio), activities(title, starts_at, meet_point)")
          .in("activity_id", hostedIds)
          .eq("status", "pending")
          .order("created_at", { ascending: true });
        if (requestsError) setError(requestsError.message);
        else setRequests(data || []);
      } catch (err) {
        setError(err.message || "Couldn't load requests. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const respond = async (requestId, status) => {
    setError("");
    setActioningId(requestId);
    try {
      const { error } = await supabase
        .from("requests")
        .update({ status })
        .eq("id", requestId);
      if (error) {
        setError(error.message);
        return;
      }
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      setError(err.message || "Couldn't update this request. Please try again.");
    } finally {
      setActioningId(null);
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

      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Pending requests</h1>

      <ErrorBanner message={error} />
      {loading && <p>Loading…</p>}
      {!loading && !error && requests.length === 0 && (
        <p style={{ color: "var(--muted)" }}>No pending requests right now.</p>
      )}

      {requests.map((r) => {
        const profile = r.profiles || {};
        const activity = r.activities || {};
        const name = profile.display_name || profile.email || "Someone";
        return (
          <div key={r.id} className="card">
            <div style={{ marginBottom: 8 }}>
              <h3 style={{ fontSize: 16, marginBottom: 2 }}>{name}</h3>
              <p className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                wants to join "{activity.title}" · {new Date(activity.starts_at).toLocaleString()}
              </p>
            </div>
            {profile.city && (
              <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 4 }}>{profile.city}</p>
            )}
            {profile.bio && <p style={{ fontSize: 14, marginBottom: 12 }}>{profile.bio}</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn-primary"
                style={{ width: "auto", padding: "10px 18px" }}
                disabled={actioningId === r.id}
                onClick={() => respond(r.id, "accepted")}
              >
                Accept
              </button>
              <button
                className="btn-secondary"
                style={{ width: "auto", padding: "10px 18px" }}
                disabled={actioningId === r.id}
                onClick={() => respond(r.id, "declined")}
              >
                Decline
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
