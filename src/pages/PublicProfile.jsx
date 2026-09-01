import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, MapPin, Languages, Star } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "../components/ErrorBanner.jsx";
import Avatar from "../components/Avatar.jsx";
import ActivityCard from "../components/ActivityCard.jsx";
import { displayName, memberSince } from "../lib/profileDisplay";

const SECTION_HEADING_STYLE = {
  fontSize: 14,
  textTransform: "uppercase",
  letterSpacing: 1,
  color: "var(--muted)",
  marginBottom: 10,
  marginTop: 20,
};

export default function PublicProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [hostedActivities, setHostedActivities] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, display_name, city, bio, languages, avatar_url, created_at")
          .eq("id", userId)
          .single();
        if (error) {
          if (!cancelled) setLoadError(error.message);
          return;
        }
        if (cancelled) return;
        setProfile(data);

        const { data: activities, error: activitiesError } = await supabase
          .from("activities")
          .select("*")
          .eq("host_id", userId)
          .gte("starts_at", new Date().toISOString())
          .order("starts_at", { ascending: true });
        if (cancelled) return;
        if (activitiesError) {
          setHostedActivities([]);
        } else {
          const upcoming = activities || [];
          const ids = upcoming.map((a) => a.id);
          const acceptedCounts = {};
          if (ids.length > 0) {
            const { data: accepted } = await supabase
              .from("requests")
              .select("activity_id")
              .in("activity_id", ids)
              .eq("status", "accepted");
            for (const r of accepted || []) {
              acceptedCounts[r.activity_id] = (acceptedCounts[r.activity_id] || 0) + 1;
            }
          }
          if (!cancelled) {
            setHostedActivities(
              upcoming.map((a) => ({ ...a, spotsTaken: acceptedCounts[a.id] || 0 }))
            );
          }
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message || "Couldn't load this profile. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (loadError) return <div style={{ padding: 24 }}><ErrorBanner message={loadError} /></div>;
  if (!profile) return <div style={{ padding: 24 }}><ErrorBanner message="This profile couldn't be found." /></div>;

  const name = displayName(profile);
  const since = memberSince(profile.created_at);

  return (
    <div style={{ padding: "24px 20px" }}>
      <button
        onClick={() => (location.key === "default" ? navigate("/") : navigate(-1))}
        className="mono"
        style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, marginBottom: 20, cursor: "pointer" }}
      >
        <ChevronLeft size={16} /> back
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <Avatar src={profile.avatar_url} name={profile.display_name} seed={profile.id} size={80} />
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 22, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name}
          </h1>
          {profile.city && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)", fontSize: 13, marginBottom: 2 }}>
              <MapPin size={13} /> {profile.city}
            </div>
          )}
          {since && (
            <p className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>Member since {since}</p>
          )}
        </div>
      </div>

      {profile.bio && (
        <>
          <h2 className="mono" style={{ ...SECTION_HEADING_STYLE, marginTop: 8 }}>About</h2>
          <p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{profile.bio}</p>
        </>
      )}

      {profile.languages && (
        <>
          <h2 className="mono" style={SECTION_HEADING_STYLE}>Languages</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
            <Languages size={15} color="var(--moss)" /> {profile.languages}
          </div>
        </>
      )}

      <h2 className="mono" style={SECTION_HEADING_STYLE}>Reviews</h2>
      <div className="card" style={{ textAlign: "center", color: "var(--muted)" }}>
        <Star size={20} color="var(--gold)" style={{ marginBottom: 8 }} />
        <p style={{ fontSize: 13 }}>Reviews are coming soon.</p>
      </div>

      <h2 className="mono" style={SECTION_HEADING_STYLE}>Hosting</h2>
      {hostedActivities.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No upcoming activities right now.</p>
      ) : (
        hostedActivities.map((a) => (
          <ActivityCard
            key={a.id}
            activity={a}
            spotsLeft={a.spots_total - a.spotsTaken}
            isFull={a.spotsTaken >= a.spots_total}
            isOwn={false}
          />
        ))
      )}
    </div>
  );
}
