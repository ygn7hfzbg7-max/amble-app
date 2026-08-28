import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, User, ClipboardList, Calendar, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ActivityCard from "../components/ActivityCard.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";

const DATE_CHIPS = [
  { key: "all", label: "All upcoming" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "weekend", label: "This weekend" },
];

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateInputValue(date) {
  const d = startOfDay(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatPillDate(dateStr) {
  const d = startOfDay(dateStr);
  const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
  const month = d.toLocaleDateString(undefined, { month: "short" });
  return `${weekday} ${d.getDate()} ${month}`;
}

function dateRangeFor(filter, customDate) {
  const todayStart = startOfDay(new Date());

  if (filter === "today") {
    return [todayStart, addDays(todayStart, 1)];
  }
  if (filter === "tomorrow") {
    const start = addDays(todayStart, 1);
    return [start, addDays(start, 1)];
  }
  if (filter === "weekend") {
    const day = todayStart.getDay(); // 0 = Sun, 6 = Sat
    let satStart;
    if (day === 6) satStart = todayStart;
    else if (day === 0) satStart = addDays(todayStart, -1);
    else satStart = addDays(todayStart, 6 - day);
    const start = satStart < todayStart ? todayStart : satStart;
    return [start, addDays(satStart, 2)];
  }
  if (filter === "custom" && customDate) {
    const start = startOfDay(customDate);
    return [start, addDays(start, 1)];
  }
  return null;
}

export default function Feed() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [customDate, setCustomDate] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          setError(userError.message);
          return;
        }
        const userId = userData.user.id;

        const { data, error } = await supabase
          .from("activities")
          .select("*")
          .gte("starts_at", new Date().toISOString())
          .neq("host_id", userId)
          .order("starts_at", { ascending: true });
        if (error) {
          setError(error.message);
          return;
        }

        const upcoming = data || [];
        const ids = upcoming.map((a) => a.id);
        const acceptedCounts = {};
        if (ids.length > 0) {
          const { data: accepted, error: acceptedError } = await supabase
            .from("requests")
            .select("activity_id")
            .in("activity_id", ids)
            .eq("status", "accepted");
          if (acceptedError) {
            setError(acceptedError.message);
            return;
          }
          for (const r of accepted || []) {
            acceptedCounts[r.activity_id] = (acceptedCounts[r.activity_id] || 0) + 1;
          }
        }

        const withSpots = upcoming.map((a) => ({
          ...a,
          spotsTaken: acceptedCounts[a.id] || 0,
        }));

        setActivities(withSpots);
      } catch (err) {
        setError(err.message || "Couldn't load activities. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const visibleActivities = useMemo(() => {
    const range = dateRangeFor(dateFilter, customDate);
    if (!range) return activities;
    const [start, end] = range;
    return activities.filter((a) => {
      const startsAt = new Date(a.starts_at);
      return startsAt >= start && startsAt < end;
    });
  }, [activities, dateFilter, customDate]);

  const selectChip = (key) => {
    setDateFilter(key);
    setCustomDate("");
  };

  const chipStyle = (active) => ({
    padding: "8px 14px",
    borderRadius: 999,
    border: `1px solid ${active ? "var(--brick)" : "var(--paper-deep)"}`,
    background: active ? "var(--brick)" : "var(--white)",
    color: active ? "var(--white)" : "var(--ink)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

  return (
    <div style={{ padding: "24px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22 }}>amble</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn-secondary"
            style={{ width: "auto", padding: 10 }}
            onClick={() => navigate("/post")}
          >
            <Plus size={16} />
          </button>
          <button
            className="btn-secondary"
            style={{ width: "auto", padding: 10 }}
            onClick={() => navigate("/my-plans")}
          >
            <ClipboardList size={16} />
          </button>
          <button
            className="btn-secondary"
            style={{ width: "auto", padding: 10 }}
            onClick={() => navigate("/profile")}
          >
            <User size={16} />
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "nowrap",
          alignItems: "center",
          gap: 8,
          marginBottom: 20,
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {DATE_CHIPS.map((c) => (
          <button
            key={c.key}
            className="mono"
            onClick={() => selectChip(c.key)}
            style={{ ...chipStyle(dateFilter === c.key), flexShrink: 0 }}
          >
            {c.label}
          </button>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <label
            className="mono"
            style={{
              ...chipStyle(dateFilter === "custom"),
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Calendar size={13} />
            {dateFilter === "custom" && customDate ? formatPillDate(customDate) : "Pick a date"}
            <input
              type="date"
              aria-label="Pick a date"
              value={customDate}
              min={toDateInputValue(new Date())}
              onChange={(e) => {
                setCustomDate(e.target.value);
                setDateFilter(e.target.value ? "custom" : "all");
              }}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                opacity: 0,
                cursor: "pointer",
                padding: 0,
                margin: 0,
                border: "none",
              }}
            />
          </label>
          {dateFilter === "custom" && customDate && (
            <button
              type="button"
              aria-label="Clear date filter"
              onClick={() => selectChip("all")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 26,
                height: 26,
                borderRadius: "50%",
                border: "1px solid var(--paper-deep)",
                background: "var(--white)",
                color: "var(--muted)",
                cursor: "pointer",
                padding: 0,
                flexShrink: 0,
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <ErrorBanner message={error} />
      {loading && <p>Loading activities…</p>}
      {!loading && !error && visibleActivities.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <p style={{ color: "var(--muted)", marginBottom: 20 }}>
            {dateFilter === "all"
              ? "No upcoming activities yet — be the first to get something going."
              : "No activities match this date — try another day, or be the first to post one."}
          </p>
          <button className="btn-primary" onClick={() => navigate("/post")}>
            Post an activity
          </button>
        </div>
      )}
      {visibleActivities.map((a) => (
        <ActivityCard
          key={a.id}
          activity={a}
          spotsLeft={a.spots_total - a.spotsTaken}
          isFull={a.spotsTaken >= a.spots_total}
        />
      ))}
    </div>
  );
}
