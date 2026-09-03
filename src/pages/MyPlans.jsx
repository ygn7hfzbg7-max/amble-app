import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Users } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "../components/ErrorBanner.jsx";
import PlanCard from "../components/PlanCard.jsx";
import ReviewPrompt from "../components/ReviewPrompt.jsx";
import { displayName as profileName } from "../lib/profileDisplay";
import { fetchPendingReviews, fetchRatingSummaries } from "../lib/reviews";
import { groupByDay } from "../lib/groupByDay";

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

const SECTION_HEADING_STYLE = {
  fontSize: 14,
  fontWeight: 700,
  color: "var(--ink)",
  marginBottom: 10,
};

function DayGroups({ plans, unreadThreads, hostRatings }) {
  const groups = groupByDay(plans, (plan) => plan.activity.starts_at);
  return groups.map((group) => (
    <div key={group.key}>
      <h2 className="day-heading">{group.heading}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {group.items.map((plan) => (
          <PlanCard
            key={`${plan.role}-${plan.activity.id}`}
            plan={plan}
            unreadThreads={unreadThreads}
            hostRating={hostRatings[plan.activity.host_id]}
          />
        ))}
      </div>
    </div>
  ));
}

export default function MyPlans() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [unreadThreads, setUnreadThreads] = useState(new Set());
  const [hostRatings, setHostRatings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          setError(userError.message);
          return;
        }
        const userId = userData.user.id;

        const { data: hostedActivities, error: hostedError } = await supabase
          .from("activities")
          .select("*")
          .eq("host_id", userId);
        if (hostedError) {
          setError(hostedError.message);
          return;
        }

        const hostedIds = (hostedActivities || []).map((a) => a.id);
        const requestsByActivity = {};
        if (hostedIds.length > 0) {
          const { data: hostedRequests, error: hostedRequestsError } = await supabase
            .from("requests")
            .select("*, profiles(display_name, avatar_url)")
            .in("activity_id", hostedIds);
          if (hostedRequestsError) {
            setError(hostedRequestsError.message);
            return;
          }
          for (const r of hostedRequests || []) {
            (requestsByActivity[r.activity_id] ||= []).push(r);
          }
        }

        const hostingPlans = (hostedActivities || []).map((activity) => {
          const activityRequests = requestsByActivity[activity.id] || [];
          const confirmed = activityRequests.filter((r) => r.status === "accepted");
          return {
            role: "hosting",
            activity,
            confirmed: confirmed.map((r) => ({
              requestId: r.id,
              travellerId: r.traveller_id,
              name: profileName(r.profiles),
              avatarUrl: r.profiles?.avatar_url,
            })),
            pendingCount: activityRequests.filter((r) => r.status === "pending" || r.status === "waitlisted").length,
          };
        });

        const { data: myRequests, error: myRequestsError } = await supabase
          .from("requests")
          .select("*, activities(*, profiles!activities_host_id_fkey(display_name, avatar_url))")
          .eq("traveller_id", userId);
        if (myRequestsError) {
          setError(myRequestsError.message);
          return;
        }

        const joiningPlans = (myRequests || [])
          .filter((r) => r.activities)
          .map((r) => ({
            role: "joining",
            activity: r.activities,
            myStatus: r.status,
            hostName: profileName(r.activities.profiles),
            hostAvatarUrl: r.activities.profiles?.avatar_url,
          }));

        const combined = [...hostingPlans, ...joiningPlans].sort(
          (a, b) => new Date(a.activity.starts_at) - new Date(b.activity.starts_at)
        );
        setPlans(combined);
        setPendingCount(hostingPlans.reduce((sum, p) => sum + p.pendingCount, 0));

        try {
          const hostIds = joiningPlans.map((p) => p.activity.host_id);
          setHostRatings(await fetchRatingSummaries(supabase, hostIds));
        } catch (ratingsErr) {
          console.error("Couldn't load host ratings:", ratingsErr.message);
        }

        const { data: unreadMessages, error: unreadError } = await supabase
          .from("messages")
          .select("activity_id, sender_id")
          .eq("recipient_id", userId)
          .is("read_at", null);
        if (unreadError) {
          setError(unreadError.message);
          return;
        }
        setUnreadThreads(
          new Set((unreadMessages || []).map((m) => `${m.activity_id}:${m.sender_id}`))
        );

        const pending = await fetchPendingReviews(supabase, userId);
        setPendingReviews(pending);
      } catch (err) {
        setError(err.message || "Couldn't load your plans. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const todayStart = startOfDay(new Date());
  const upcoming = [];
  const past = [];
  for (const plan of plans) {
    const start = new Date(plan.activity.starts_at);
    (start < todayStart ? past : upcoming).push(plan);
  }
  past.reverse();

  const hasAnyPlans = plans.length > 0;

  return (
    <div style={{ padding: "24px 20px" }}>
      <button
        onClick={() => navigate(-1)}
        className="mono"
        style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, marginBottom: 20, cursor: "pointer" }}
      >
        <ChevronLeft size={16} /> back
      </button>

      <h1 style={{ fontSize: 22, marginBottom: 20 }}>My plans</h1>

      <ErrorBanner message={error} />
      {loading && <p>Loading…</p>}

      {!loading && pendingCount > 0 && (
        <div
          className="card"
          style={{
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "var(--brick)",
            border: "none",
          }}
          onClick={() => navigate("/my-plans/requests")}
        >
          <Users size={18} color="var(--white)" />
          <span className="mono" style={{ color: "var(--white)", fontSize: 13, fontWeight: 600 }}>
            {pendingCount} {pendingCount === 1 ? "person wants" : "people want"} to join your plans
          </span>
        </div>
      )}

      {!loading && pendingReviews.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h2 className="mono" style={SECTION_HEADING_STYLE}>
            Leave a review
          </h2>
          {pendingReviews.map((pr) => (
            <ReviewPrompt key={`${pr.activityId}-${pr.revieweeId}`} pending={pr} />
          ))}
        </div>
      )}

      {!loading && !error && !hasAnyPlans && (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <p style={{ color: "var(--muted)", marginBottom: 20 }}>
            No plans yet — browse activities to join one, or post your own.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button className="btn-primary" onClick={() => navigate("/")}>
              Browse activities
            </button>
            <button className="btn-secondary" onClick={() => navigate("/post")}>
              Post an activity
            </button>
          </div>
        </div>
      )}

      {!loading && (
        <>
          {upcoming.length > 0 && (
            <DayGroups plans={upcoming} unreadThreads={unreadThreads} hostRatings={hostRatings} />
          )}

          {past.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <button
                onClick={() => setShowPast((s) => !s)}
                className="mono"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--muted)",
                  fontSize: 13,
                  cursor: "pointer",
                  padding: 0,
                  marginBottom: showPast ? 12 : 0,
                }}
              >
                {showPast ? "Hide" : "Show"} past ({past.length})
              </button>
              {showPast && <DayGroups plans={past} unreadThreads={unreadThreads} hostRatings={hostRatings} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}
