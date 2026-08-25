import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "../components/ErrorBanner.jsx";

const STATUS_LABEL = {
  pending: "Pending",
  accepted: "Confirmed",
  declined: "Declined",
};

const STATUS_COLOR = {
  pending: "var(--muted)",
  accepted: "var(--moss)",
  declined: "var(--brick)",
};

export default function ActivityRequests() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activity, setActivity] = useState(null);
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

        const { data: activityData, error: activityError } = await supabase
          .from("activities")
          .select("*")
          .eq("id", id)
          .single();
        if (activityError) {
          setError(activityError.message);
          return;
        }
        if (activityData.host_id !== userData.user.id) {
          navigate(`/activity/${id}`);
          return;
        }
        setActivity(activityData);

        const { data: requestData, error: requestsError } = await supabase
          .from("requests")
          .select("*, profiles(display_name, email, city, bio)")
          .eq("activity_id", id)
          .order("created_at", { ascending: true });
        if (requestsError) setError(requestsError.message);
        else setRequests(requestData || []);
      } catch (err) {
        setError(err.message || "Couldn't load requests. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

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
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status } : r))
      );
    } catch (err) {
      setError(err.message || "Couldn't update this request. Please try again.");
    } finally {
      setActioningId(null);
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (error && !activity) return <div style={{ padding: 24 }}><ErrorBanner message={error} /></div>;

  return (
    <div style={{ padding: "24px 20px" }}>
      <button
        onClick={() => navigate(-1)}
        className="mono"
        style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, marginBottom: 20, cursor: "pointer" }}
      >
        <ChevronLeft size={16} /> back
      </button>

      <h1 style={{ fontSize: 22, marginBottom: 8 }}>{activity.title}</h1>
      <div className="card" style={{ marginBottom: 20 }}>
        <p><strong>When:</strong> {new Date(activity.starts_at).toLocaleString()}</p>
        <p><strong>Meet at:</strong> {activity.meet_point}</p>
      </div>

      <ErrorBanner message={error} />

      {requests.length === 0 && (
        <p style={{ color: "var(--muted)" }}>No one has requested to join yet.</p>
      )}

      {requests.map((r) => {
        const profile = r.profiles || {};
        const name = profile.display_name || profile.email || "Someone";
        return (
          <div key={r.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <h3 style={{ fontSize: 16 }}>{name}</h3>
              <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLOR[r.status] || "var(--muted)" }}>
                {STATUS_LABEL[r.status] || r.status}
              </span>
            </div>
            {profile.city && (
              <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 4 }}>{profile.city}</p>
            )}
            {profile.bio && (
              <p style={{ fontSize: 14, marginBottom: 12 }}>{profile.bio}</p>
            )}
            {r.status === "accepted" && (
              <p style={{ color: "var(--moss)", fontSize: 13, marginBottom: 12 }}>
                Confirmed for {new Date(activity.starts_at).toLocaleString()} at {activity.meet_point}.
              </p>
            )}
            {r.status === "pending" && (
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
            )}
          </div>
        );
      })}
    </div>
  );
}
