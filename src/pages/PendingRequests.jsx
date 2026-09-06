import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "../components/ErrorBanner.jsx";
import Avatar from "../components/Avatar.jsx";
import RatingSummary from "../components/RatingSummary.jsx";
import TierBadge from "../components/TierBadge.jsx";
import { displayName } from "../lib/profileDisplay";
import { fetchRatingSummaries } from "../lib/reviews";
import { formatDateTime } from "../lib/formatDateTime";

const SECTION_HEADING_STYLE = {
  fontSize: 14,
  fontWeight: 700,
  color: "var(--ink)",
  marginBottom: 10,
  marginTop: 8,
};

export default function PendingRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [acceptedCounts, setAcceptedCounts] = useState({});
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

        const { data: hostedActivities, error: hostedError } = await supabase
          .from("activities")
          .select("id")
          .eq("host_id", userData.user.id)
          .eq("status", "active");
        if (hostedError) {
          setError(hostedError.message);
          return;
        }

        const hostedIds = (hostedActivities || []).map((a) => a.id);
        if (hostedIds.length === 0) {
          setRequests([]);
          return;
        }

        const { data: acceptedRequests, error: acceptedError } = await supabase
          .from("requests")
          .select("activity_id")
          .in("activity_id", hostedIds)
          .eq("status", "accepted");
        if (acceptedError) {
          setError(acceptedError.message);
          return;
        }
        const counts = {};
        for (const r of acceptedRequests || []) {
          counts[r.activity_id] = (counts[r.activity_id] || 0) + 1;
        }
        setAcceptedCounts(counts);

        const { data, error: requestsError } = await supabase
          .from("requests")
          .select("*, profiles(display_name, avatar_url, city, bio, verification_tier), activities(title, starts_at, meet_point, spots_total)")
          .in("activity_id", hostedIds)
          .in("status", ["pending", "waitlisted"])
          .order("created_at", { ascending: true });
        if (requestsError) {
          setError(requestsError.message);
        } else {
          setRequests(data || []);
          try {
            setRatings(await fetchRatingSummaries(supabase, (data || []).map((r) => r.traveller_id)));
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
  }, []);

  const respond = async (request, status) => {
    setError("");
    setActioningId(request.id);
    try {
      const { error } = await supabase
        .from("requests")
        .update({ status })
        .eq("id", request.id);
      if (error) {
        setError(error.message);
        return;
      }
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
      if (status === "accepted") {
        setAcceptedCounts((prev) => ({
          ...prev,
          [request.activity_id]: (prev[request.activity_id] || 0) + 1,
        }));
      }
    } catch (err) {
      setError(err.message || "Couldn't update this request. Please try again.");
    } finally {
      setActioningId(null);
    }
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const waitlistedRequests = requests.filter((r) => r.status === "waitlisted");

  const renderRequest = (r) => {
    const profile = r.profiles || {};
    const activity = r.activities || {};
    const name = displayName(profile);
    const spotsFree = activity.spots_total != null
      ? activity.spots_total - (acceptedCounts[r.activity_id] || 0)
      : null;
    return (
      <div key={r.id} className="listing-card" style={{ cursor: "default", marginBottom: 10 }}>
        <div
          role="button"
          tabIndex={0}
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
          onClick={() => navigate(`/profile/${r.traveller_id}`)}
          onKeyDown={(e) => e.key === "Enter" && navigate(`/profile/${r.traveller_id}`)}
        >
          <Avatar src={profile.avatar_url} name={profile.display_name} seed={r.traveller_id} size={36} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {name}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
              <RatingSummary summary={ratings[r.traveller_id]} size={10} />
              <TierBadge tier={profile.verification_tier} size={10} />
              {profile.city && (
                <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{profile.city}</span>
              )}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 12 }}>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Wants to join "{activity.title}"
          </div>
          <div className="mono" style={{ marginTop: 2 }}>{formatDateTime(activity.starts_at)}</div>
        </div>
        {profile.bio && <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8, marginBottom: 0 }}>{profile.bio}</p>}
        {r.status === "waitlisted" && spotsFree > 0 && (
          <p className="mono" style={{ color: "var(--gold)", fontSize: 12, marginTop: 8, marginBottom: 0 }}>
            A spot is open — you can accept them now.
          </p>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            className="btn-primary"
            style={{ width: "auto", padding: "8px 14px", fontSize: 13 }}
            disabled={actioningId === r.id || spotsFree <= 0}
            title={spotsFree <= 0 ? "No spots open right now" : undefined}
            onClick={() => respond(r, "accepted")}
          >
            Accept
          </button>
          <button
            className="btn-secondary"
            style={{ width: "auto", padding: "8px 14px", fontSize: 13 }}
            disabled={actioningId === r.id}
            onClick={() => respond(r, "declined")}
          >
            Decline
          </button>
        </div>
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

      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Pending requests</h1>

      <ErrorBanner message={error} />
      {loading && <p>Loading…</p>}
      {!loading && !error && requests.length === 0 && (
        <p style={{ color: "var(--muted)" }}>No pending requests right now.</p>
      )}

      {pendingRequests.map(renderRequest)}

      {waitlistedRequests.length > 0 && (
        <>
          <h2 className="mono" style={SECTION_HEADING_STYLE}>Waitlist</h2>
          {waitlistedRequests.map(renderRequest)}
        </>
      )}
    </div>
  );
}
