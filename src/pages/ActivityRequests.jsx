import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "../components/ErrorBanner.jsx";
import Avatar from "../components/Avatar.jsx";
import RatingSummary from "../components/RatingSummary.jsx";
import { displayName } from "../lib/profileDisplay";
import { fetchRatingSummaries } from "../lib/reviews";
import { formatDateTime } from "../lib/formatDateTime";

const STATUS_LABEL = {
  pending: "Pending",
  accepted: "Confirmed",
  declined: "Declined",
  waitlisted: "Waitlisted",
};

const STATUS_COLOR = {
  pending: "var(--muted)",
  accepted: "var(--moss)",
  declined: "var(--brick)",
  waitlisted: "var(--gold)",
};

const SECTION_HEADING_STYLE = {
  fontSize: 14,
  textTransform: "uppercase",
  letterSpacing: 1,
  color: "var(--muted)",
  marginBottom: 10,
  marginTop: 8,
};

export default function ActivityRequests() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activity, setActivity] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState(null);
  const [ratings, setRatings] = useState({});

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
          .select("*, profiles(display_name, avatar_url, city, bio)")
          .eq("activity_id", id)
          .order("created_at", { ascending: true });
        if (requestsError) {
          setError(requestsError.message);
        } else {
          setRequests(requestData || []);
          try {
            setRatings(await fetchRatingSummaries(supabase, (requestData || []).map((r) => r.traveller_id)));
          } catch (ratingsErr) {
            console.error("Couldn't load ratings:", ratingsErr.message);
          }
        }
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

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const waitlistedRequests = requests.filter((r) => r.status === "waitlisted");
  const otherRequests = requests.filter((r) => r.status === "accepted" || r.status === "declined");

  const acceptedCount = requests.filter((r) => r.status === "accepted").length;
  const spotsFree = activity.spots_total - acceptedCount;

  const renderRequest = (r, { showAccept, showDecline, showRemove, showMessage } = {}) => {
    const profile = r.profiles || {};
    const name = displayName(profile);
    return (
      <div key={r.id} className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div
            role="button"
            tabIndex={0}
            style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, cursor: "pointer" }}
            onClick={() => navigate(`/profile/${r.traveller_id}`)}
            onKeyDown={(e) => e.key === "Enter" && navigate(`/profile/${r.traveller_id}`)}
          >
            <Avatar src={profile.avatar_url} name={profile.display_name} seed={r.traveller_id} size={36} />
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>{name}</h3>
              <RatingSummary summary={ratings[r.traveller_id]} size={10} />
            </div>
          </div>
          <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLOR[r.status] || "var(--muted)", flexShrink: 0 }}>
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
            Confirmed for {formatDateTime(activity.starts_at)} at {activity.meet_point}.
          </p>
        )}
        {r.status === "waitlisted" && spotsFree > 0 && (
          <p className="mono" style={{ color: "var(--gold)", fontSize: 12, marginBottom: 12 }}>
            A spot is open — you can accept them now.
          </p>
        )}
        {(showAccept || showDecline || showRemove || showMessage) && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {showMessage && (
              <button
                className="btn-secondary"
                style={{ width: "auto", padding: "10px 18px", display: "flex", alignItems: "center", gap: 6 }}
                onClick={() => navigate(`/chat/${activity.id}/${r.traveller_id}`)}
              >
                <MessageCircle size={16} /> Message
              </button>
            )}
            {showAccept && (
              <button
                className="btn-primary"
                style={{ width: "auto", padding: "10px 18px" }}
                disabled={actioningId === r.id || spotsFree <= 0}
                title={spotsFree <= 0 ? "No spots open right now" : undefined}
                onClick={() => respond(r.id, "accepted")}
              >
                Accept
              </button>
            )}
            {showDecline && (
              <button
                className="btn-secondary"
                style={{ width: "auto", padding: "10px 18px" }}
                disabled={actioningId === r.id}
                onClick={() => respond(r.id, "declined")}
              >
                Decline
              </button>
            )}
            {showRemove && (
              <button
                className="btn-secondary"
                style={{ width: "auto", padding: "10px 18px", borderColor: "var(--brick)", color: "var(--brick)" }}
                disabled={actioningId === r.id}
                onClick={() => respond(r.id, "declined")}
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    );
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

      <h1 style={{ fontSize: 22, marginBottom: 8 }}>{activity.title}</h1>
      <div className="card" style={{ marginBottom: 20 }}>
        <p><strong>When:</strong> {formatDateTime(activity.starts_at)}</p>
        <p><strong>Meet at:</strong> {activity.meet_point}</p>
        <p><strong>Spots:</strong> {acceptedCount}/{activity.spots_total} confirmed</p>
      </div>

      <ErrorBanner message={error} />

      {requests.length === 0 && (
        <p style={{ color: "var(--muted)" }}>No one has requested to join yet.</p>
      )}

      {pendingRequests.map((r) => renderRequest(r, { showAccept: true, showDecline: true }))}

      {waitlistedRequests.length > 0 && (
        <>
          <h2 className="mono" style={SECTION_HEADING_STYLE}>Waitlist</h2>
          {waitlistedRequests.map((r) => renderRequest(r, { showAccept: true, showDecline: true }))}
        </>
      )}

      {otherRequests.map((r) =>
        renderRequest(r, { showRemove: r.status === "accepted", showMessage: r.status === "accepted" })
      )}
    </div>
  );
}
