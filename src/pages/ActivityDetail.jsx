import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "../components/ErrorBanner.jsx";
import ActivityMap from "../components/ActivityMap.jsx";

export default function ActivityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activity, setActivity] = useState(null);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [userId, setUserId] = useState(null);
  const [myRequestStatus, setMyRequestStatus] = useState(null);
  const [requestError, setRequestError] = useState("");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          setLoadError(userError.message);
          return;
        }
        setUserId(userData.user.id);

        const { data, error } = await supabase.from("activities").select("*").eq("id", id).single();
        if (error) {
          setLoadError(error.message);
          return;
        }
        setActivity(data);

        const { data: acceptedRequests, error: acceptedError } = await supabase
          .from("requests")
          .select("id")
          .eq("activity_id", id)
          .eq("status", "accepted");
        if (acceptedError) {
          setLoadError(acceptedError.message);
          return;
        }
        setAcceptedCount((acceptedRequests || []).length);

        if (data.host_id !== userData.user.id) {
          const { data: myRequest, error: myRequestError } = await supabase
            .from("requests")
            .select("status")
            .eq("activity_id", id)
            .eq("traveller_id", userData.user.id)
            .maybeSingle();
          if (myRequestError) setLoadError(myRequestError.message);
          else setMyRequestStatus(myRequest?.status || null);
        }
      } catch (err) {
        setLoadError(err.message || "Couldn't load this activity. Please try again.");
      }
    })();
  }, [id]);

  const isFull = activity ? acceptedCount >= activity.spots_total : false;

  const handleRequest = async () => {
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

  const isHost = activity.host_id === userId;
  const canSeeExact = isHost || myRequestStatus === "accepted";
  const hasLocation = activity.latitude != null && activity.longitude != null;
  const areaLabel = [activity.city, activity.country].filter(Boolean).join(", ");
  const meetPointLabel = canSeeExact
    ? activity.meet_point
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

      <h1 style={{ fontSize: 22, marginBottom: 8 }}>{activity.title}</h1>
      <p style={{ color: "var(--muted)", marginBottom: 20 }}>{activity.description}</p>

      {hasLocation && (
        <ActivityMap
          latitude={Number(activity.latitude)}
          longitude={Number(activity.longitude)}
          precise={canSeeExact}
        />
      )}

      <div className="card">
        <p><strong>When:</strong> {new Date(activity.starts_at).toLocaleString()}</p>
        <p><strong>Meet at:</strong> {meetPointLabel}</p>
        <p><strong>Fee:</strong> {activity.fee ? `£${activity.fee}` : "Free"}</p>
        <p>
          <strong>Spots:</strong>{" "}
          {isFull ? (
            <span style={{ color: "var(--brick)", fontWeight: 600 }}>Full</span>
          ) : (
            `${activity.spots_total - acceptedCount} of ${activity.spots_total} left`
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
            <p style={{ color: "var(--moss)", fontWeight: 600 }}>
              You're confirmed! Meet at {activity.meet_point} on{" "}
              {new Date(activity.starts_at).toLocaleString()}.
            </p>
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
          {myRequestStatus === null && (
            <button className="btn-primary" onClick={handleRequest} disabled={requesting}>
              {requesting ? "Sending…" : isFull ? "Join waitlist" : "Request to join"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
