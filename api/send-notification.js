// Vercel serverless function — the single HTTP target for Supabase Database
// Webhooks on the `requests` and `messages` tables. See the PR description
// / README for the exact webhook setup steps (table, event, URL) to
// configure in the Supabase dashboard, since that config can't be applied
// from here.
//
// Supabase's webhook payload shape (for INSERT/UPDATE):
//   { type: "INSERT" | "UPDATE" | "DELETE", table, schema, record, old_record }
//
// A failed or skipped email must never surface as an error to Supabase —
// the underlying row change already happened before this function runs, so
// there's nothing here that should ever be "rolled back". Every branch
// catches its own errors and this handler always responds 200.
import { getAdminClient } from "./_lib/db.js";
import { sendEmail, emailShell } from "./_lib/email.js";
import { siteUrl } from "./_lib/siteUrl.js";
import { formatDateTime } from "../src/lib/formatDateTime.js";

const CHAT_DEBOUNCE_MS = 15 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const secret = process.env.SUPABASE_WEBHOOK_SECRET;
  if (secret && req.headers["x-webhook-secret"] !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { table, type, record, old_record } = req.body || {};

  try {
    if (table === "requests") {
      await handleRequestEvent({ type, record, old_record });
    } else if (table === "messages") {
      await handleMessageEvent({ type, record });
    }
  } catch (err) {
    console.error("send-notification handler failed:", err);
  }

  res.status(200).json({ ok: true });
}

async function getNotifiableProfile(db, id) {
  const { data, error } = await db
    .from("profiles")
    .select("email, display_name, notifications_enabled")
    .eq("id", id)
    .single();
  if (error) {
    console.error(`Couldn't load profile ${id}:`, error.message);
    return null;
  }
  if (!data?.email || data.notifications_enabled === false) return null;
  return data;
}

async function handleRequestEvent({ type, record, old_record }) {
  if (!record) return;
  const db = getAdminClient();

  if (type === "INSERT") {
    await notifyNewRequest(db, record);
    return;
  }

  if (type === "UPDATE") {
    const prevStatus = old_record?.status;
    if (record.status === "accepted" && prevStatus !== "accepted") {
      await notifyRequestAccepted(db, record);
    } else if (record.status === "declined" && prevStatus !== "declined") {
      await notifyRequestDeclined(db, record);
    }
  }
}

async function notifyNewRequest(db, record) {
  const { data: activity, error: activityError } = await db
    .from("activities")
    .select("id, title, host_id")
    .eq("id", record.activity_id)
    .single();
  if (activityError || !activity) {
    console.error("notifyNewRequest: couldn't load activity", activityError?.message);
    return;
  }

  const [host, traveller] = await Promise.all([
    getNotifiableProfile(db, activity.host_id),
    db.from("profiles").select("display_name").eq("id", record.traveller_id).single(),
  ]);
  if (!host) return;

  const travellerName = traveller?.data?.display_name?.trim() || "Someone";
  const url = `${siteUrl()}/activity/${activity.id}/requests`;

  await sendEmail({
    to: host.email,
    subject: `${travellerName} wants to join ${activity.title}`,
    html: emailShell({
      heading: `${travellerName} wants to join ${activity.title}`,
      body: "Take a look at their request and let them know if they're in.",
      ctaLabel: "View request",
      ctaUrl: url,
    }),
  });
}

async function notifyRequestAccepted(db, record) {
  const { data: activity, error: activityError } = await db
    .from("activities")
    .select("id, title, starts_at, meet_point, city, country")
    .eq("id", record.activity_id)
    .single();
  if (activityError || !activity) {
    console.error("notifyRequestAccepted: couldn't load activity", activityError?.message);
    return;
  }

  const traveller = await getNotifiableProfile(db, record.traveller_id);
  if (!traveller) return;

  const url = `${siteUrl()}/activity/${activity.id}`;
  const when = activity.starts_at ? formatDateTime(activity.starts_at) : "the scheduled time";
  const where = activity.meet_point || [activity.city, activity.country].filter(Boolean).join(", ") || "shared in the app";

  await sendEmail({
    to: traveller.email,
    subject: `You're confirmed for ${activity.title}`,
    html: emailShell({
      heading: `You're confirmed for ${activity.title}`,
      body: `Meet at ${where} on ${when}.`,
      ctaLabel: "View activity",
      ctaUrl: url,
    }),
  });
}

async function notifyRequestDeclined(db, record) {
  const { data: activity, error: activityError } = await db
    .from("activities")
    .select("id, title")
    .eq("id", record.activity_id)
    .single();
  if (activityError || !activity) {
    console.error("notifyRequestDeclined: couldn't load activity", activityError?.message);
    return;
  }

  const traveller = await getNotifiableProfile(db, record.traveller_id);
  if (!traveller) return;

  const url = `${siteUrl()}/`;

  await sendEmail({
    to: traveller.email,
    subject: `About your request to join ${activity.title}`,
    html: emailShell({
      heading: `Not this time`,
      body: `The host wasn't able to take you along for ${activity.title}. There's plenty more happening — take a look at what else is out there.`,
      ctaLabel: "Browse activities",
      ctaUrl: url,
    }),
  });
}

async function handleMessageEvent({ type, record }) {
  if (type !== "INSERT" || !record) return;
  const db = getAdminClient();

  const recipient = await getNotifiableProfile(db, record.recipient_id);
  if (!recipient) return;

  const shouldSend = await shouldSendChatNotification(db, record);
  if (!shouldSend) return;

  const [{ data: sender }, { data: activity }] = await Promise.all([
    db.from("profiles").select("display_name").eq("id", record.sender_id).single(),
    db.from("activities").select("id, title").eq("id", record.activity_id).single(),
  ]);
  if (!activity) return;

  const senderName = sender?.display_name?.trim() || "Someone";
  const preview = String(record.body || "").slice(0, 140);
  const url = `${siteUrl()}/chat/${activity.id}/${record.sender_id}`;

  const result = await sendEmail({
    to: recipient.email,
    subject: `New message from ${senderName}`,
    html: emailShell({
      heading: `${senderName} sent you a message`,
      body: preview,
      ctaLabel: "Reply",
      ctaUrl: url,
    }),
  });

  if (result.sent) {
    await db.from("message_notification_state").upsert(
      {
        activity_id: record.activity_id,
        sender_id: record.sender_id,
        recipient_id: record.recipient_id,
        last_notified_at: new Date().toISOString(),
        last_notified_message_id: record.id,
      },
      { onConflict: "activity_id,sender_id,recipient_id" }
    );
  }
}

// Debounce: skip if we already emailed the recipient about this
// conversation within the last 15 minutes, unless they've since read the
// message that notification was about (in which case a fresh message
// deserves a fresh ping even inside the cooldown window).
async function shouldSendChatNotification(db, record) {
  const { data: state, error } = await db
    .from("message_notification_state")
    .select("last_notified_at, last_notified_message_id")
    .eq("activity_id", record.activity_id)
    .eq("sender_id", record.sender_id)
    .eq("recipient_id", record.recipient_id)
    .maybeSingle();
  if (error) {
    console.error("Couldn't load message_notification_state:", error.message);
    return true;
  }
  if (!state?.last_notified_at) return true;

  const withinCooldown = Date.now() - new Date(state.last_notified_at).getTime() < CHAT_DEBOUNCE_MS;
  if (!withinCooldown) return true;

  if (state.last_notified_message_id) {
    const { data: prevMessage } = await db
      .from("messages")
      .select("read_at")
      .eq("id", state.last_notified_message_id)
      .maybeSingle();
    if (prevMessage?.read_at) return true;
  }

  return false;
}
