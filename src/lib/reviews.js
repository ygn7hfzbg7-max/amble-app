// Shared helpers for the two-sided review system — tag vocab, the 14-day
// visibility window, and the queries used to figure out which reviews a
// user still owes (My Plans prompts + the Feed badge) and how someone's
// reviews roll up (profile pages, activity cards, request lists).

export const REVIEW_WINDOW_DAYS = 14;

// Shown when reviewing a host.
export const HOST_TAGS = ["Showed up on time", "Great local knowledge", "Felt safe", "Would meet again"];
// Shown when reviewing a traveller.
export const TRAVELLER_TAGS = ["On time", "Respectful of plans", "Easy company", "Would host again"];

export function reviewWindowEnd(startsAt) {
  const d = new Date(startsAt);
  d.setDate(d.getDate() + REVIEW_WINDOW_DAYS);
  return d;
}

export function hasActivityStarted(startsAt, now = new Date()) {
  return new Date(startsAt) <= now;
}

export function isReviewWindowOpen(startsAt, now = new Date()) {
  return now < reviewWindowEnd(startsAt);
}

// Every activity that has started, where the current user was actually
// matched with someone (host <-> an accepted traveller) and hasn't yet
// reviewed them, and the 14-day window hasn't closed. Used both for the
// "How was your walk with X?" prompts on My Plans and for the outstanding
// count badged onto the My Plans icon in the Feed header.
//
// NOTE for future notification work: this is the single source of truth for
// "reviews a user owes right now." Once email/push exists, the place to
// hook it in is wherever an activity's start time passes — a scheduled job
// (or the first fetchPendingReviews call after it) can diff against
// previously-sent prompts and fire a notification per new entry, without
// changing this function's shape.
export async function fetchPendingReviews(supabase, userId) {
  const now = new Date();
  const pending = [];

  const { data: hostedActivities, error: hostedError } = await supabase
    .from("activities")
    .select("id, title, starts_at")
    .eq("host_id", userId)
    .lte("starts_at", now.toISOString());
  if (hostedError) throw hostedError;

  const hostedOpen = (hostedActivities || []).filter((a) => isReviewWindowOpen(a.starts_at, now));
  const hostedIds = hostedOpen.map((a) => a.id);

  const confirmedByActivity = {};
  if (hostedIds.length > 0) {
    const { data: confirmed, error: confirmedError } = await supabase
      .from("requests")
      .select("activity_id, traveller_id, profiles(display_name, avatar_url)")
      .in("activity_id", hostedIds)
      .eq("status", "accepted");
    if (confirmedError) throw confirmedError;
    for (const r of confirmed || []) {
      (confirmedByActivity[r.activity_id] ||= []).push(r);
    }
  }

  const { data: myRequests, error: myRequestsError } = await supabase
    .from("requests")
    .select("activity_id, activities(id, title, starts_at, host_id, profiles!activities_host_id_fkey(display_name, avatar_url))")
    .eq("traveller_id", userId)
    .eq("status", "accepted");
  if (myRequestsError) throw myRequestsError;

  const joiningOpen = (myRequests || []).filter(
    (r) => r.activities && isReviewWindowOpen(r.activities.starts_at, now) && hasActivityStarted(r.activities.starts_at, now)
  );

  const { data: myReviews, error: myReviewsError } = await supabase
    .from("reviews")
    .select("activity_id, reviewee_id")
    .eq("reviewer_id", userId);
  if (myReviewsError) throw myReviewsError;
  const reviewedSet = new Set((myReviews || []).map((r) => `${r.activity_id}:${r.reviewee_id}`));

  for (const activity of hostedOpen) {
    for (const c of confirmedByActivity[activity.id] || []) {
      const key = `${activity.id}:${c.traveller_id}`;
      if (reviewedSet.has(key)) continue;
      pending.push({
        activityId: activity.id,
        activityTitle: activity.title,
        startsAt: activity.starts_at,
        revieweeId: c.traveller_id,
        revieweeName: c.profiles?.display_name,
        revieweeAvatar: c.profiles?.avatar_url,
        direction: "host", // I am the host, reviewing a confirmed traveller
      });
    }
  }

  for (const r of joiningOpen) {
    const activity = r.activities;
    const key = `${activity.id}:${activity.host_id}`;
    if (reviewedSet.has(key)) continue;
    pending.push({
      activityId: activity.id,
      activityTitle: activity.title,
      startsAt: activity.starts_at,
      revieweeId: activity.host_id,
      revieweeName: activity.profiles?.display_name,
      revieweeAvatar: activity.profiles?.avatar_url,
      direction: "traveller", // I am a traveller, reviewing the host
    });
  }

  return pending;
}

// Average rating + count for a single person. Respects RLS — visible
// reviews to anyone, plus (only for the reviewer themself) their own
// not-yet-visible ones — so this is always what the current viewer would
// legitimately see.
export async function fetchRatingSummary(supabase, userId) {
  const { data, error } = await supabase.from("reviews").select("rating").eq("reviewee_id", userId);
  if (error) throw error;
  const rows = data || [];
  if (rows.length === 0) return { average: null, count: 0 };
  const sum = rows.reduce((s, r) => s + r.rating, 0);
  return { average: sum / rows.length, count: rows.length };
}

// Batched version for lists (Feed cards, request lists) so we don't fire
// one query per person.
export async function fetchRatingSummaries(supabase, userIds) {
  const unique = Array.from(new Set((userIds || []).filter(Boolean)));
  if (unique.length === 0) return {};
  const { data, error } = await supabase.from("reviews").select("reviewee_id, rating").in("reviewee_id", unique);
  if (error) throw error;
  const totals = {};
  for (const row of data || []) {
    const entry = (totals[row.reviewee_id] ||= { sum: 0, count: 0 });
    entry.sum += row.rating;
    entry.count += 1;
  }
  const result = {};
  for (const id of unique) {
    const entry = totals[id];
    result[id] = entry ? { average: entry.sum / entry.count, count: entry.count } : { average: null, count: 0 };
  }
  return result;
}
