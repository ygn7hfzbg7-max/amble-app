// Vercel Cron target (see vercel.json's `crons` entry) that prompts hosts
// and travellers to review each other once an activity has started.
//
// This one deliberately isn't a Database Webhook like send-notification.js:
// a review reminder needs to fire when an activity's *start time* passes,
// which isn't a row insert or update on any table — it's simply time
// elapsing. A periodic cron sweep is the natural fit; review_reminder_state
// (see the SQL in the PR description) keeps it idempotent across runs, the
// same way message_notification_state debounces chat emails.
import { getAdminClient } from "./_lib/db.js";
import { sendEmail, emailShell } from "./_lib/email.js";
import { siteUrl } from "./_lib/siteUrl.js";
import { formatDateTime } from "../src/lib/formatDateTime.js";
import { REVIEW_WINDOW_DAYS } from "../src/lib/reviews.js";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically
  // once CRON_SECRET is set as an env var — this just stops anyone else
  // from triggering the sweep on demand.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers["authorization"] !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const sent = await sendReviewReminders();
    res.status(200).json({ ok: true, sent });
  } catch (err) {
    console.error("review-reminders failed:", err);
    res.status(200).json({ ok: false, error: err.message });
  }
}

async function sendReviewReminders() {
  const db = getAdminClient();
  const now = new Date();
  const windowFloor = new Date(now);
  windowFloor.setDate(windowFloor.getDate() - REVIEW_WINDOW_DAYS);

  // Activities that have started but whose 14-day review window hasn't
  // closed yet — the same bounds src/lib/reviews.js uses client-side.
  const { data: activities, error: activitiesError } = await db
    .from("activities")
    .select("id, title, starts_at, host_id")
    .lte("starts_at", now.toISOString())
    .gt("starts_at", windowFloor.toISOString());
  if (activitiesError) throw activitiesError;
  if (!activities?.length) return 0;

  const activityIds = activities.map((a) => a.id);

  const [{ data: accepted, error: acceptedError }, { data: reviews, error: reviewsError }, { data: reminded, error: remindedError }] =
    await Promise.all([
      db.from("requests").select("activity_id, traveller_id").in("activity_id", activityIds).eq("status", "accepted"),
      db.from("reviews").select("activity_id, reviewer_id, reviewee_id").in("activity_id", activityIds),
      db.from("review_reminder_state").select("activity_id, recipient_id").in("activity_id", activityIds),
    ]);
  if (acceptedError) throw acceptedError;
  if (reviewsError) throw reviewsError;
  if (remindedError) throw remindedError;

  const reviewedSet = new Set((reviews || []).map((r) => `${r.activity_id}:${r.reviewer_id}:${r.reviewee_id}`));
  const remindedSet = new Set((reminded || []).map((r) => `${r.activity_id}:${r.recipient_id}`));

  const travellersByActivity = {};
  for (const r of accepted || []) {
    (travellersByActivity[r.activity_id] ||= []).push(r.traveller_id);
  }

  // One pending entry per (activity, recipient) — a host with several
  // confirmed travellers still gets a single reminder listing all of them,
  // not one email per person.
  const pendingByKey = new Map();
  const addPending = (activity, recipientId, revieweeId) => {
    const key = `${activity.id}:${recipientId}`;
    if (remindedSet.has(key)) return;
    if (!pendingByKey.has(key)) {
      pendingByKey.set(key, { activity, recipientId, revieweeIds: [] });
    }
    pendingByKey.get(key).revieweeIds.push(revieweeId);
  };

  for (const activity of activities) {
    for (const travellerId of travellersByActivity[activity.id] || []) {
      if (!reviewedSet.has(`${activity.id}:${activity.host_id}:${travellerId}`)) {
        addPending(activity, activity.host_id, travellerId);
      }
      if (!reviewedSet.has(`${activity.id}:${travellerId}:${activity.host_id}`)) {
        addPending(activity, travellerId, activity.host_id);
      }
    }
  }

  if (pendingByKey.size === 0) return 0;

  const recipientIds = Array.from(new Set(Array.from(pendingByKey.values()).map((p) => p.recipientId)));
  const { data: profiles, error: profilesError } = await db
    .from("profiles")
    .select("id, email, notifications_enabled")
    .in("id", recipientIds);
  if (profilesError) throw profilesError;
  const profileById = new Map((profiles || []).map((p) => [p.id, p]));

  let sentCount = 0;
  const stateRows = [];

  for (const { activity, recipientId, revieweeIds } of pendingByKey.values()) {
    const profile = profileById.get(recipientId);
    if (!profile?.email || profile.notifications_enabled === false) continue;

    const url = `${siteUrl()}/activity/${activity.id}/review/${revieweeIds[0]}`;
    const when = activity.starts_at ? formatDateTime(activity.starts_at) : "";
    const body =
      revieweeIds.length > 1
        ? `${activity.title}${when ? ` (${when})` : ""} has wrapped up — let your fellow travellers know how it went.`
        : `${activity.title}${when ? ` (${when})` : ""} has wrapped up — take a moment to leave a review.`;

    const result = await sendEmail({
      to: profile.email,
      subject: `How was ${activity.title}?`,
      html: emailShell({
        heading: `How was ${activity.title}?`,
        body,
        ctaLabel: "Leave a review",
        ctaUrl: url,
      }),
    });

    if (result.sent) {
      sentCount += 1;
      stateRows.push({ activity_id: activity.id, recipient_id: recipientId, sent_at: new Date().toISOString() });
    }
  }

  if (stateRows.length > 0) {
    const { error: insertError } = await db
      .from("review_reminder_state")
      .upsert(stateRows, { onConflict: "activity_id,recipient_id" });
    if (insertError) console.error("Couldn't record review_reminder_state:", insertError.message);
  }

  return sentCount;
}
