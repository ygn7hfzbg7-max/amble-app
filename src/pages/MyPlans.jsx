import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Users } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "../components/ErrorBanner.jsx";
import PlanCard from "../components/PlanCard.jsx";

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function profileName(profile) {
  if (!profile) return "Someone";
  return profile.display_name || profile.email || "Someone";
}

const SECTION_HEADING_STYLE = {
  fontSize: 14,
  textTransform: "uppercase",
  letterSpacing: 1,
  color: "var(--muted)",
  marginBottom: 10,
};

function Section({ title, plans }) {
  if (plans.length === 0) return null;
  return (
    <>
      <h2 className="mono" style={SECTION_HEADING_STYLE}>
        {title}
      </h2>
      {plans.map((plan) => (
        <PlanCard key={`${plan.role}-${plan.activity.id}`} plan={plan} />
      ))}
    </>
  );
}

export default function MyPlans() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
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
            .select("*, profiles(display_name, email)")
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
            confirmedCount: confirmed.length,
            confirmedNames: confirmed.map((r) => profileName(r.profiles)),
            pendingCount: activityRequests.filter((r) => r.status === "pending" || r.status === "waitlisted").length,
          };
        });

        const { data: myRequests, error: myRequestsError } = await supabase
          .from("requests")
          .select("*, activities(*, profiles(display_name, email))")
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
          }));

        const combined = [...hostingPlans, ...joiningPlans].sort(
          (a, b) => new Date(a.activity.starts_at) - new Date(b.activity.starts_at)
        );
        setPlans(combined);
        setPendingCount(hostingPlans.reduce((sum, p) => sum + p.pendingCount, 0));
      } catch (err) {
        setError(err.message || "Couldn't load your plans. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const groups = { today: [], thisWeek: [], later: [], past: [] };
  for (const plan of plans) {
    const start = new Date(plan.activity.starts_at);
    if (start < todayStart) groups.past.push(plan);
    else if (start < tomorrowStart) groups.today.push(plan);
    else if (start < weekEnd) groups.thisWeek.push(plan);
    else groups.later.push(plan);
  }
  groups.past.reverse();

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
          <Section title="Today" plans={groups.today} />
          <Section title="This week" plans={groups.thisWeek} />
          <Section title="Later" plans={groups.later} />

          {groups.past.length > 0 && (
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
                {showPast ? "Hide" : "Show"} past ({groups.past.length})
              </button>
              {showPast && groups.past.map((plan) => (
                <PlanCard key={`${plan.role}-${plan.activity.id}`} plan={plan} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
