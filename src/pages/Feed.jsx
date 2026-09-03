import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, User, ClipboardList, Calendar, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ActivityCard from "../components/ActivityCard.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import LocationFilter from "../components/LocationFilter.jsx";
import { distanceKm } from "../lib/geo";
import { fetchPendingReviews, fetchRatingSummaries } from "../lib/reviews";
import { formatDateOnly } from "../lib/formatDateTime";
import { groupByDay } from "../lib/groupByDay";

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
  return formatDateOnly(startOfDay(dateStr));
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

function dateContextPhrase(filter, customDate) {
  if (filter === "today") return "today";
  if (filter === "tomorrow") return "tomorrow";
  if (filter === "weekend") return "this weekend";
  if (filter === "custom" && customDate) return `on ${formatPillDate(customDate)}`;
  return "";
}

export default function Feed() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [customDate, setCustomDate] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [cityFilter, setCityFilter] = useState(searchParams.get("city") || "");
  const [nearMe, setNearMe] = useState(false);
  const [userCoords, setUserCoords] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [hostRatings, setHostRatings] = useState({});
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
          .select("*, profiles!activities_host_id_fkey(display_name, avatar_url)")
          .gte("starts_at", new Date().toISOString())
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
          isOwn: a.host_id === userId,
        }));

        setActivities(withSpots);

        const hostIds = upcoming.map((a) => a.host_id);
        try {
          setHostRatings(await fetchRatingSummaries(supabase, hostIds));
        } catch (ratingsErr) {
          // Non-fatal — cards just fall back to "New to Amble" styling.
          console.error("Couldn't load host ratings:", ratingsErr.message);
        }
      } catch (err) {
        setError(err.message || "Couldn't load activities. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    let channel;
    (async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) return;
      const userId = userData.user.id;

      const { count, error: countError } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .is("read_at", null);
      if (countError) {
        setError(countError.message);
        return;
      }
      setUnreadCount(count || 0);

      try {
        const pending = await fetchPendingReviews(supabase, userId);
        setPendingReviewCount(pending.length);
      } catch (reviewsErr) {
        setError(reviewsErr.message || "Couldn't load your pending reviews.");
      }

      channel = supabase
        .channel(`unread-messages-${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${userId}` },
          () => setUnreadCount((c) => c + 1)
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Sync the active city into the URL so a filtered feed can be shared or
  // restored on refresh, without relying on local/session storage.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (cityFilter) next.set("city", cityFilter);
    else next.delete("city");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityFilter]);

  const availableCities = useMemo(() => {
    const cities = new Set(activities.map((a) => a.city).filter(Boolean));
    return Array.from(cities).sort((a, b) => a.localeCompare(b));
  }, [activities]);

  const activitiesWithDistance = useMemo(() => {
    if (!nearMe || !userCoords) return activities;
    return activities.map((a) => {
      if (a.latitude == null || a.longitude == null) return a;
      const lat = Number(a.latitude);
      const lng = Number(a.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return a;
      return {
        ...a,
        distanceKm: distanceKm(userCoords.lat, userCoords.lng, lat, lng),
      };
    });
  }, [activities, userCoords, nearMe]);

  // Stays in date order (activitiesWithDistance is already ascending by
  // starts_at) so day headings group cleanly; distance sorting, when
  // active, is applied within each day group instead of flattening it.
  const visibleActivities = useMemo(() => {
    const range = dateRangeFor(dateFilter, customDate);
    return activitiesWithDistance.filter((a) => {
      if (range) {
        const startsAt = new Date(a.starts_at);
        if (startsAt < range[0] || startsAt >= range[1]) return false;
      }
      if (cityFilter && a.city !== cityFilter) return false;
      return true;
    });
  }, [activitiesWithDistance, dateFilter, customDate, cityFilter]);

  const dayGroups = useMemo(() => {
    const groups = groupByDay(visibleActivities, (a) => a.starts_at);
    if (!nearMe || !userCoords) return groups;
    return groups.map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => {
        const da = typeof a.distanceKm === "number" ? a.distanceKm : Infinity;
        const db = typeof b.distanceKm === "number" ? b.distanceKm : Infinity;
        return da - db;
      }),
    }));
  }, [visibleActivities, nearMe, userCoords]);

  const selectChip = (key) => {
    setDateFilter(key);
    setCustomDate("");
  };

  const selectCity = (city) => {
    setCityFilter(city);
  };

  const clearCity = () => {
    setCityFilter("");
  };

  const toggleNearMe = () => {
    if (nearMe) {
      setNearMe(false);
      return;
    }
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError("Location isn't available in this browser.");
      return;
    }
    if (userCoords) {
      setNearMe(true);
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setNearMe(true);
        setGeoLoading(false);
      },
      () => {
        // Permission denied or unavailable — fall back to the normal list
        // without nagging the user again.
        setGeoError("Couldn't get your location — showing all activities instead.");
        setGeoLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  };

  const chipStyle = (active) => ({
    padding: "8px 14px",
    borderRadius: 999,
    border: `1px solid ${active ? "var(--brick)" : "var(--border)"}`,
    background: active ? "var(--brick)" : "var(--paper-deep)",
    color: active ? "var(--white)" : "var(--ink)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

  return (
    <div style={{ padding: "24px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, color: "var(--brick)" }}>amble</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn-secondary"
            style={{ width: "auto", padding: 10, background: "var(--paper-deep)" }}
            onClick={() => navigate("/post")}
          >
            <Plus size={16} />
          </button>
          <div style={{ position: "relative" }}>
            <button
              className="btn-secondary"
              style={{ width: "auto", padding: 10, background: "var(--paper-deep)" }}
              onClick={() => navigate("/my-plans")}
            >
              <ClipboardList size={16} />
            </button>
            {unreadCount + pendingReviewCount > 0 && (
              <span
                className="mono"
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  background: "var(--brick)",
                  color: "var(--white)",
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 700,
                  minWidth: 16,
                  height: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 3px",
                }}
              >
                {unreadCount + pendingReviewCount > 9 ? "9+" : unreadCount + pendingReviewCount}
              </span>
            )}
          </div>
          <button
            className="btn-secondary"
            style={{ width: "auto", padding: 10, background: "var(--paper-deep)" }}
            onClick={() => navigate("/profile")}
          >
            <User size={16} />
          </button>
        </div>
      </div>

      <LocationFilter
        cities={availableCities}
        value={cityFilter}
        onSelect={selectCity}
        onClear={clearCity}
        nearMe={nearMe}
        onToggleNearMe={toggleNearMe}
        geoLoading={geoLoading}
        geoError={geoError}
      />

      {(cityFilter || dateFilter !== "all" || nearMe) && (
        <div
          className="mono"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 6,
            marginBottom: 12,
            fontSize: 11,
            color: "var(--muted)",
          }}
        >
          <span>Showing:</span>
          {cityFilter && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ink)", fontWeight: 600 }}>
              {cityFilter}
              <button
                type="button"
                aria-label="Clear city filter"
                onClick={clearCity}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex", padding: 0 }}
              >
                <X size={11} />
              </button>
            </span>
          )}
          {dateFilter !== "all" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ink)", fontWeight: 600 }}>
              {cityFilter && "·"} {dateContextPhrase(dateFilter, customDate) || "custom date"}
              <button
                type="button"
                aria-label="Clear date filter"
                onClick={() => selectChip("all")}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex", padding: 0 }}
              >
                <X size={11} />
              </button>
            </span>
          )}
          {nearMe && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ink)", fontWeight: 600 }}>
              {(cityFilter || dateFilter !== "all") && "·"} sorted by distance
              <button
                type="button"
                aria-label="Turn off near me"
                onClick={() => setNearMe(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex", padding: 0 }}
              >
                <X size={11} />
              </button>
            </span>
          )}
        </div>
      )}

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
                border: "1px solid var(--border)",
                background: "var(--paper-deep)",
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
            {cityFilter || dateFilter !== "all" ? (
              <>
                No activities
                {cityFilter ? ` in ${cityFilter}` : ""}
                {dateFilter !== "all" ? ` ${dateContextPhrase(dateFilter, customDate)}` : ""}.{" "}
                Try {cityFilter && dateFilter !== "all" ? "clearing the city or date" : cityFilter ? "clearing the city" : "another day"}, or be the first to post one.
              </>
            ) : (
              "No upcoming activities yet — be the first to get something going."
            )}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {cityFilter && (
              <button className="btn-secondary" style={{ width: "auto", padding: "10px 16px" }} onClick={clearCity}>
                Clear city
              </button>
            )}
            {dateFilter !== "all" && (
              <button className="btn-secondary" style={{ width: "auto", padding: "10px 16px" }} onClick={() => selectChip("all")}>
                Clear date
              </button>
            )}
            <button className="btn-primary" style={{ width: "auto", padding: "10px 16px" }} onClick={() => navigate("/post")}>
              Post an activity
            </button>
          </div>
        </div>
      )}
      {dayGroups.map((group) => (
        <div key={group.key}>
          <h2 className="day-heading">{group.heading}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {group.items.map((a) => (
              <ActivityCard
                key={a.id}
                activity={a}
                spotsLeft={a.spots_total - a.spotsTaken}
                isFull={a.spotsTaken >= a.spots_total}
                isOwn={a.isOwn}
                distanceKm={a.distanceKm}
                hostRating={hostRatings[a.host_id]}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
