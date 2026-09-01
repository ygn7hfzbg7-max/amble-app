import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, MapPin, Languages, Star } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "../components/ErrorBanner.jsx";
import Avatar from "../components/Avatar.jsx";
import ActivityCard from "../components/ActivityCard.jsx";
import StarRating from "../components/StarRating.jsx";
import RatingSummary from "../components/RatingSummary.jsx";
import { displayName, memberSince } from "../lib/profileDisplay";
import { formatDateTime } from "../lib/formatDateTime";

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
  const [reviews, setReviews] = useState([]);
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

        const { data: reviewRows, error: reviewsError } = await supabase
          .from("reviews")
          .select("*, profiles!reviews_reviewer_id_fkey(display_name, avatar_url)")
          .eq("reviewee_id", userId)
          .order("created_at", { ascending: false });
        if (!cancelled) {
          if (reviewsError) console.error("Couldn't load reviews:", reviewsError.message);
          else setReviews(reviewRows || []);
        }

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
  const ratingSummary =
    reviews.length > 0
      ? { average: reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length, count: reviews.length }
      : { average: null, count: 0 };

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
          <div style={{ marginBottom: 4 }}>
            <RatingSummary summary={ratingSummary} size={12} />
          </div>
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
      {reviews.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--muted)" }}>
          <Star size={20} color="var(--gold)" style={{ marginBottom: 8 }} />
          <p style={{ fontSize: 13 }}>New to Amble — no reviews yet.</p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Star size={18} color="var(--gold)" fill="var(--gold)" />
            <span style={{ fontSize: 18, fontWeight: 700 }}>{ratingSummary.average.toFixed(1)}</span>
            <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
              ({reviews.length} review{reviews.length === 1 ? "" : "s"})
            </span>
          </div>
          {reviews.map((r) => {
            const reviewer = r.profiles || {};
            return (
              <div key={r.id} className="card">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <Avatar src={reviewer.avatar_url} name={reviewer.display_name} seed={r.reviewer_id} size={32} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {displayName(reviewer)}
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
                      {formatDateTime(r.created_at)}
                    </div>
                  </div>
                  <StarRating value={r.rating} size={14} />
                </div>
                {r.tags && r.tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: r.note ? 8 : 0 }}>
                    {r.tags.map((tag) => (
                      <span
                        key={tag}
                        className="mono"
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--moss)",
                          border: "1px solid var(--moss)",
                          borderRadius: 999,
                          padding: "2px 8px",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {r.note && <p style={{ fontSize: 13 }}>{r.note}</p>}
              </div>
            );
          })}
        </>
      )}

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
            hostRating={ratingSummary}
          />
        ))
      )}
    </div>
  );
}
