import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "../components/ErrorBanner.jsx";
import ErrorBoundary from "../components/ErrorBoundary.jsx";
import ActivityMap from "../components/ActivityMap.jsx";

export default function ActivityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activity, setActivity] = useState(null);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [warning, setWarning] = useState("");
  const [userId, setUserId] = useState(null);
  const [myRequestStatus, setMyRequestStatus] = useState(null);
  const [requestError, setRequestError] = useState("");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          if (!cancelled) setLoadError(userError.message);
          return;
        }
        const me = userData?.user?.id || null;
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
      <button
        onClick={() => navigate(-1)}
        className="mono"
        style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, marginBottom: 20, cursor: "pointer" }}
      >
        <ChevronLeft size={16} /> back
      </button>

      <ErrorBoundary
        fallback={
          <div>
            <ErrorBanner message="Something went wrong showing this activity. Please try refreshing." />
          </div>
        }
      >
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>{activity.title}</h1>
      <p style={{ color: "var(--muted)", marginBottom: 20 }}>{activity.description}</p>

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

      <div className="card">
        <p><strong>When:</strong> {activity.starts_at ? new Date(activity.starts_at).toLocaleString() : "TBD"}</p>
        <p><strong>Meet at:</strong> {meetPointLabel}</p>
        <p><strong>Fee:</strong> {activity.fee ? `£${activity.fee}` : "Free"}</p>
        <p>
          <strong>Spots:</strong>{" "}
          {isFull ? (
            <span style={{ color: "var(--brick)", fontWeight: 600 }}>Full</span>
          ) : spotsTotal != null ? (
            `${Math.max(spotsTotal - acceptedCount, 0)} of ${spotsTotal} left`
          ) : (
            "TBD"
          )}
        </p>
      </div>

      {isHost && (
        <button className="btn-primary" onClick={() => navigate(`/activity/${id}/requests`)}>
          View requests
        </button>
      )}

      {!isHost && (
        <>
          <ErrorBanner message={requestError} />
          {myRequestStatus === "accepted" && (
            <>
              <p style={{ color: "var(--moss)", fontWeight: 600 }}>
                You're confirmed! Meet at {activity.meet_point || "the spot shared by the host"} on{" "}
                {activity.starts_at ? new Date(activity.starts_at).toLocaleString() : "the scheduled time"}.
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
            <button className="btn-primary" onClick={handleRequest} disabled={requesting || !userId}>
              {requesting ? "Sending…" : isFull ? "Join waitlist" : "Request to join"}
            </button>
          )}
        </>
      )}
      </ErrorBoundary>
    </div>
  );
}
