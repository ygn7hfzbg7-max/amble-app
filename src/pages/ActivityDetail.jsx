import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "../components/ErrorBanner.jsx";
import ErrorBoundary from "../components/ErrorBoundary.jsx";
import ActivityMap from "../components/ActivityMap.jsx";
import ShareButton from "../components/ShareButton.jsx";
import Avatar from "../components/Avatar.jsx";
import RatingSummary from "../components/RatingSummary.jsx";
import { displayName } from "../lib/profileDisplay";
import { fetchRatingSummary, fetchRatingSummaries } from "../lib/reviews";
import { formatDateTime } from "../lib/formatDateTime";

export default function ActivityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [activity, setActivity] = useState(null);
  const [hostProfile, setHostProfile] = useState(null);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [warning, setWarning] = useState("");
  const [userId, setUserId] = useState(null);
  const [myRequestStatus, setMyRequestStatus] = useState(null);
  const [requestError, setRequestError] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [confirmedAttendees, setConfirmedAttendees] = useState([]);
  const [hostRating, setHostRating] = useState(null);
  const [attendeeRatings, setAttendeeRatings] = useState({});

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // getSession() (unlike getUser()) doesn't error out for a logged-out
        // visitor — it just resolves with session: null — so an unauthenticated
        // viewer still gets the public activity view instead of an error banner.
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          if (!cancelled) setLoadError(sessionError.message);
          return;
        }
        const me = sessionData?.session?.user?.id || null;
        if (cancelled) return;
        setUserId(me);

        const { data, error } = await supabase.from("activities").select("*").eq("id", id).single();
        if (error) {
          if (!cancelled) setLoadError(error.message);
          return;
        }
        if (cancelled) return;
        setActivity(data);

        // Everything below is supplementary — if it fails, the activity
        // itself still renders with safe defaults (0 accepted, no request).
        if (data?.host_id) {
          const { data: host, error: hostError } = await supabase
            .from("profiles")
            .select("id, display_name, avatar_url")
            .eq("id", data.host_id)
            .single();
          if (cancelled) return;
          if (hostError) {
            setWarning((w) => w || "Couldn't load host details.");
          } else {
            setHostProfile(host);
          }
          try {
            const summary = await fetchRatingSummary(supabase, data.host_id);
            if (!cancelled) setHostRating(summary);
          } catch (ratingErr) {
            console.error("Couldn't load host rating:", ratingErr.message);
          }
        }

        const { data: acceptedRequests, error: acceptedError } = await supabase
          .from("requests")
          .select("id")
          .eq("activity_id", id)
          .eq("status", "accepted");
        if (cancelled) return;
        if (acceptedError) {
          setWarning((w) => w || "Some details couldn't be loaded. Spot counts may be off.");
        } else {
          setAcceptedCount((acceptedRequests || []).length);
        }

        if (me && data?.host_id !== me) {
          const { data: myRequest, error: myRequestError } = await supabase
            .from("requests")
            .select("status")
            .eq("activity_id", id)
            .eq("traveller_id", me)
            .maybeSingle();
          if (cancelled) return;
          if (myRequestError) {
            setWarning((w) => w || "Couldn't load your request status. Please refresh.");
          } else {
            setMyRequestStatus(myRequest?.status || null);
          }
        }

        if (me && data?.host_id === me) {
          const { data: confirmedRequests, error: confirmedError } = await supabase
            .from("requests")
            .select("id, traveller_id, profiles(display_name, avatar_url)")
            .eq("activity_id", id)
            .eq("status", "accepted");
          if (cancelled) return;
          if (confirmedError) {
            setWarning((w) => w || "Couldn't load confirmed attendees.");
          } else {
            setConfirmedAttendees(confirmedRequests || []);
            try {
              const summaries = await fetchRatingSummaries(
                supabase,
                (confirmedRequests || []).map((r) => r.traveller_id)
              );
              if (!cancelled) setAttendeeRatings(summaries);
            } catch (ratingsErr) {
              console.error("Couldn't load attendee ratings:", ratingsErr.message);
            }
          }
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message || "Couldn't load this activity. Please try again.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const spotsTotal = Number.isFinite(activity?.spots_total) ? activity.spots_total : null;
  const isFull = spotsTotal != null ? acceptedCount >= spotsTotal : false;

  const handleRequest = async () => {
    if (!userId) {
      setRequestError("You need to be signed in to request to join.");
      return;
    }
    setRequestError("");
    setRequesting(true);
    try {
      const status = isFull ? "waitlisted" : "pending";
      const { error } = await supabase.from("requests").insert({
        activity_id: id,
        traveller_id: userId,
        status,
      });
      if (error) setRequestError(error.message);
      else setMyRequestStatus(status);
    } catch (err) {
      setRequestError(err.message || "Couldn't send your request. Please try again.");
    } finally {
      setRequesting(false);
    }
  };

  if (loadError) return <div style={{ padding: 24 }}><ErrorBanner message={loadError} /></div>;
  if (!activity) return <div style={{ padding: 24 }}>Loading…</div>;

  const isHost = Boolean(userId) && activity.host_id === userId;
  const canSeeExact = isHost || myRequestStatus === "accepted";
  const latitude = Number(activity.latitude);
  const longitude = Number(activity.longitude);
  const hasLocation = activity.latitude != null && activity.longitude != null;
  const areaLabel = [activity.city, activity.country].filter(Boolean).join(", ");
  const meetPointLabel = canSeeExact
    ? activity.meet_point || "Details shared by the host."
    : areaLabel
    ? `Near ${areaLabel} — exact spot shared once you're confirmed.`
    : "Shared once you're confirmed.";

  return (
    <div style={{ padding: "24px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button
          onClick={() => (location.key === "default" ? navigate("/") : navigate(-1))}
          className="mono"
          style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
        >
          <ChevronLeft size={16} /> back
        </button>
        <ShareButton
          title={activity.title}
          text={`Join me for ${activity.title}${areaLabel ? ` in ${areaLabel}` : ""} on Amble.`}
          url={`${window.location.origin}/activity/${id}`}
          style={{ width: "auto", padding: "8px 14px" }}
        />
      </div>

      <ErrorBoundary
        fallback={
          <div>
            <ErrorBanner message="Something went wrong showing this activity. Please try refreshing." />
          </div>
        }
      >
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>{activity.title}</h1>
      <div
        style={{
          fontFamily: '"Space Grotesk", sans-serif',
          fontWeight: 700,
          fontSize: 20,
          color: "var(--ink)",
          marginBottom: 16,
        }}
      >
        {activity.starts_at ? formatDateTime(activity.starts_at) : "Time TBD"}
      </div>

      {activity.host_id && (
        <div
          className="card"
          role="button"
          tabIndex={0}
          style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
          onClick={() => navigate(`/profile/${activity.host_id}`)}
          onKeyDown={(e) => e.key === "Enter" && navigate(`/profile/${activity.host_id}`)}
        >
          <Avatar src={hostProfile?.avatar_url} name={hostProfile?.display_name} seed={activity.host_id} size={48} />
          <div style={{ minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Hosted by</div>
            <div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>
              {displayName(hostProfile)}
            </div>
            <RatingSummary summary={hostRating} size={11} />
          </div>
        </div>
      )}

      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16 }}>{activity.description}</p>

      <ErrorBanner message={warning} />

      {hasLocation && (
        <ErrorBoundary fallback={<p className="mono" style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>Map unavailable right now.</p>}>
          <ActivityMap
            latitude={latitude}
            longitude={longitude}
            precise={canSeeExact}
            meetPoint={canSeeExact ? activity.meet_point : undefined}
          />
        </ErrorBoundary>
      )}

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Meet at</div>
          <div style={{ fontSize: 14 }}>{meetPointLabel}</div>
        </div>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Fee</div>
          <div style={{ fontSize: 14 }}>{activity.fee ? `£${activity.fee}` : "Free"}</div>
        </div>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Spots</div>
          <div style={{ fontSize: 14 }}>
            {isFull ? (
              <span style={{ color: "var(--brick)", fontWeight: 600 }}>Full</span>
            ) : spotsTotal != null ? (
              `${Math.max(spotsTotal - acceptedCount, 0)} of ${spotsTotal} left`
            ) : (
              "TBD"
            )}
          </div>
        </div>
      </div>

      {isHost && (
        <>
          <h2 className="day-heading" style={{ fontSize: 14, marginTop: 8 }}>
            Confirmed attendees
          </h2>
          {confirmedAttendees.length === 0 ? (
            <p style={{ color: "var(--muted)", marginBottom: 16 }}>No one confirmed yet.</p>
          ) : (
            <div className="card" style={{ padding: "0 14px", marginBottom: 16 }}>
              {confirmedAttendees.map((r) => {
                const profile = r.profiles || {};
                const name = displayName(profile);
                return (
                  <div key={r.id} className="person-row">
                    <div
                      role="button"
                      tabIndex={0}
                      style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, cursor: "pointer" }}
                      onClick={() => navigate(`/profile/${r.traveller_id}`)}
                      onKeyDown={(e) => e.key === "Enter" && navigate(`/profile/${r.traveller_id}`)}
                    >
                      <Avatar src={profile.avatar_url} name={profile.display_name} seed={r.traveller_id} size={32} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {name}
                        </div>
                        <RatingSummary summary={attendeeRatings[r.traveller_id]} size={10} />
                      </div>
                    </div>
                    <button
                      className="btn-secondary"
                      style={{ width: "auto", padding: "8px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
                      onClick={() => navigate(`/chat/${id}/${r.traveller_id}`)}
                    >
                      <MessageCircle size={16} /> Message
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <button className="btn-primary" onClick={() => navigate(`/activity/${id}/requests`)}>
            View requests
          </button>
        </>
      )}

      {!isHost && (
        <>
          <ErrorBanner message={requestError} />
          {myRequestStatus === "accepted" && (
            <>
              <p style={{ color: "var(--moss)", fontWeight: 600 }}>
                You're confirmed! Meet at {activity.meet_point || "the spot shared by the host"} on{" "}
                {activity.starts_at ? formatDateTime(activity.starts_at) : "the scheduled time"}.
              </p>
              {activity.host_id && (
                <button
                  className="btn-secondary"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  onClick={() => navigate(`/chat/${id}/${activity.host_id}`)}
                >
                  <MessageCircle size={16} /> Message host
                </button>
              )}
            </>
          )}
          {myRequestStatus === "pending" && (
            <p style={{ color: "var(--moss)", fontWeight: 600 }}>
              Request sent — you'll be notified when the host responds.
            </p>
          )}
          {myRequestStatus === "waitlisted" && (
            <p style={{ color: "var(--gold)", fontWeight: 600 }}>
              You're on the waitlist — we'll let you know if a spot opens up.
            </p>
          )}
          {myRequestStatus === "declined" && (
            <p style={{ color: "var(--muted)" }}>
              The host declined your request to join this one.
            </p>
          )}
          {myRequestStatus == null && (
            userId ? (
              <button className="btn-primary" onClick={handleRequest} disabled={requesting}>
                {requesting ? "Sending…" : isFull ? "Join waitlist" : "Request to join"}
              </button>
            ) : (
              <button
                className="btn-primary"
                onClick={() => navigate(`/login?redirect=/activity/${id}`)}
              >
                Sign up or log in to request to join
              </button>
            )
          )}
        </>
      )}
      </ErrorBoundary>
    </div>
  );
}
