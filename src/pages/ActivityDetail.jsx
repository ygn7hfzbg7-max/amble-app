import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "../components/ErrorBanner.jsx";

export default function ActivityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activity, setActivity] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [requested, setRequested] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from("activities").select("*").eq("id", id).single();
        if (error) setLoadError(error.message);
        else setActivity(data);
      } catch (err) {
        setLoadError(err.message || "Couldn't load this activity. Please try again.");
      }
    })();
  }, [id]);

  const handleRequest = async () => {
    setRequestError("");
    setRequesting(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        setRequestError(userError.message);
        return;
      }
      const { error } = await supabase.from("requests").insert({
        activity_id: id,
        traveller_id: userData.user.id,
      });
      if (error) setRequestError(error.message);
      else setRequested(true);
    } catch (err) {
      setRequestError(err.message || "Couldn't send your request. Please try again.");
    } finally {
      setRequesting(false);
    }
  };

  if (loadError) return <div style={{ padding: 24 }}><ErrorBanner message={loadError} /></div>;
  if (!activity) return <div style={{ padding: 24 }}>Loading…</div>;

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

      <div className="card">
        <p><strong>When:</strong> {new Date(activity.starts_at).toLocaleString()}</p>
        <p><strong>Meet at:</strong> {activity.meet_point}</p>
        <p><strong>Fee:</strong> {activity.fee ? `£${activity.fee}` : "Free"}</p>
      </div>

      <ErrorBanner message={requestError} />
      {requested ? (
        <p style={{ color: "var(--moss)", fontWeight: 600 }}>
          Request sent — you'll be notified when the host responds.
        </p>
      ) : (
        <button className="btn-primary" onClick={handleRequest} disabled={requesting}>
          {requesting ? "Sending…" : "Request to join"}
        </button>
      )}
    </div>
  );
}
