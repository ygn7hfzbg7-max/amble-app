import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Lock } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "../components/ErrorBanner.jsx";
import Avatar from "../components/Avatar.jsx";
import StarRating from "../components/StarRating.jsx";
import { displayName } from "../lib/profileDisplay";
import { HOST_TAGS, TRAVELLER_TAGS, reviewWindowEnd, hasActivityStarted } from "../lib/reviews";

function tagPillStyle(active) {
  return {
    padding: "8px 14px",
    borderRadius: 999,
    border: `1px solid ${active ? "var(--moss)" : "var(--paper-deep)"}`,
    background: active ? "var(--moss)" : "var(--white)",
    color: active ? "var(--white)" : "var(--ink)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  };
}

export default function ReviewSubmit() {
  const { activityId, revieweeId } = useParams();
  const navigate = useNavigate();

  const [userId, setUserId] = useState(null);
  const [activity, setActivity] = useState(null);
  const [reviewee, setReviewee] = useState(null);
  const [eligible, setEligible] = useState(null);
  const [existingReview, setExistingReview] = useState(null);
  const [locked, setLocked] = useState(false);

  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState([]);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          setLoadError(userError.message);
          return;
        }
        const me = userData.user.id;
        if (cancelled) return;
        setUserId(me);

        const { data: activityData, error: activityError } = await supabase
          .from("activities")
          .select("id, title, starts_at, host_id")
          .eq("id", activityId)
          .single();
        if (activityError) {
          setLoadError(activityError.message);
          return;
        }
        if (cancelled) return;
        setActivity(activityData);

        const { data: revieweeProfile, error: revieweeError } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .eq("id", revieweeId)
          .single();
        if (revieweeError) {
          setLoadError(revieweeError.message);
          return;
        }
        if (cancelled) return;
        setReviewee(revieweeProfile);

        const iAmHost = activityData.host_id === me;
        let matched = false;
        if (iAmHost) {
          const { data: req, error: reqError } = await supabase
            .from("requests")
            .select("id")
            .eq("activity_id", activityId)
            .eq("traveller_id", revieweeId)
            .eq("status", "accepted")
            .maybeSingle();
          if (reqError) {
            setLoadError(reqError.message);
            return;
          }
          matched = Boolean(req);
        } else if (activityData.host_id === revieweeId) {
          const { data: req, error: reqError } = await supabase
            .from("requests")
            .select("id")
            .eq("activity_id", activityId)
            .eq("traveller_id", me)
            .eq("status", "accepted")
            .maybeSingle();
          if (reqError) {
            setLoadError(reqError.message);
            return;
          }
          matched = Boolean(req);
        }
        if (cancelled) return;
        setEligible(matched);

        if (matched) {
          const { data: mine, error: mineError } = await supabase
            .from("reviews")
            .select("*")
            .eq("activity_id", activityId)
            .eq("reviewer_id", me)
            .eq("reviewee_id", revieweeId)
            .maybeSingle();
          if (mineError) {
            setLoadError(mineError.message);
            return;
          }
          if (cancelled) return;
          if (mine) {
            setExistingReview(mine);
            setRating(mine.rating);
            setSelectedTags(mine.tags || []);
            setNote(mine.note || "");

            const { data: isVisible, error: visError } = await supabase.rpc("review_is_visible", {
              activity: activityId,
              reviewer: me,
              reviewee: revieweeId,
            });
            if (visError) {
              setLoadError(visError.message);
              return;
            }
            if (cancelled) return;
            setLocked(Boolean(isVisible));
          }
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message || "Couldn't load this review. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activityId, revieweeId]);

  const toggleTag = (tag) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) {
      setSubmitError("Please choose a star rating.");
      return;
    }
    setSubmitError("");
    setSubmitting(true);
    try {
      const { error } = await supabase.from("reviews").upsert(
        {
          activity_id: activityId,
          reviewer_id: userId,
          reviewee_id: revieweeId,
          rating,
          tags: selectedTags,
          note: note.trim() || null,
        },
        { onConflict: "activity_id,reviewer_id,reviewee_id" }
      );
      if (error) {
        setSubmitError(error.message);
        return;
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.message || "Couldn't submit your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (loadError)
    return (
      <div style={{ padding: 24 }}>
        <ErrorBanner message={loadError} />
      </div>
    );

  const started = hasActivityStarted(activity.starts_at);
  const iAmHost = activity.host_id === userId;
  const tagOptions = iAmHost ? TRAVELLER_TAGS : HOST_TAGS;
  const name = displayName(reviewee);
  const deadline = reviewWindowEnd(activity.starts_at);
  const showReadOnly = submitted || locked;

  return (
    <div style={{ padding: "24px 20px" }}>
      <button
        onClick={() => navigate(-1)}
        className="mono"
        style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, marginBottom: 20, cursor: "pointer" }}
      >
        <ChevronLeft size={16} /> back
      </button>

      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Review {name}</h1>
      <p style={{ color: "var(--muted)", marginBottom: 20 }}>
        {activity.title} · {new Date(activity.starts_at).toLocaleDateString()}
      </p>

      {!started && <ErrorBanner message="You'll be able to review this once the activity has happened." />}

      {started && eligible === false && (
        <ErrorBanner message="You can only review someone you were actually matched with on this activity." />
      )}

      {started && eligible && (
        <>
          <div className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar src={reviewee.avatar_url} name={reviewee.display_name} seed={reviewee.id} size={48} />
            <div style={{ fontWeight: 700, fontSize: 16 }}>{name}</div>
          </div>

          {showReadOnly ? (
            <div className="card">
              <div style={{ marginBottom: 12 }}>
                <StarRating value={rating} size={26} />
              </div>
              {selectedTags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  {selectedTags.map((tag) => (
                    <span key={tag} className="mono" style={tagPillStyle(true)}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {note && <p style={{ fontSize: 14, marginBottom: 12, whiteSpace: "pre-wrap" }}>{note}</p>}
              <p className="mono" style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                <Lock size={13} />
                {locked
                  ? "This review is now visible and can no longer be edited."
                  : `Saved — it stays hidden until ${name} submits theirs too, or ${deadline.toLocaleDateString()}, whichever comes first.`}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <label className="mono" style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 8 }}>
                Your rating
              </label>
              <div style={{ marginBottom: 20 }}>
                <StarRating value={rating} onChange={setRating} size={32} />
              </div>

              <label className="mono" style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 8 }}>
                What stood out? (optional)
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                {tagOptions.map((tag) => (
                  <button
                    type="button"
                    key={tag}
                    className="mono"
                    style={tagPillStyle(selectedTags.includes(tag))}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <label className="mono" style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 8 }}>
                Add a note (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder="How did it go?"
                style={{ resize: "vertical" }}
              />

              <div
                className="card mono"
                style={{ background: "rgba(180, 144, 58, 0.08)", border: "1px solid var(--gold)", fontSize: 12, color: "var(--ink)", display: "flex", gap: 8, alignItems: "flex-start" }}
              >
                <Lock size={14} style={{ flexShrink: 0, marginTop: 1 }} color="var(--gold)" />
                <span>
                  Your review stays hidden until {name} submits theirs too, or {deadline.toLocaleDateString()} — whichever comes
                  first. This keeps reviews honest, not retaliatory.
                </span>
              </div>

              <ErrorBanner message={submitError} />

              <button className="btn-primary" type="submit" disabled={submitting}>
                {submitting ? "Submitting…" : existingReview ? "Update review" : "Submit review"}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
