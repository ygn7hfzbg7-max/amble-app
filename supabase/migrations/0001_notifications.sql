-- Email notifications (Resend) — schema additions.
--
-- Not applied automatically: paste this into the Supabase SQL editor for
-- your project, same as the rest of this app's schema (see
-- src/lib/supabaseClient.js). See the PR description for the accompanying
-- Database Webhook + Cron setup steps in the Supabase/Vercel dashboards.

-- 1. Per-user opt-out flag, checked before every notification email.
-- No settings UI yet — this just makes the flag available for when one
-- ships.
alter table profiles
  add column if not exists notifications_enabled boolean not null default true;

-- 2. Chat email debounce. Tracks the last time a recipient was emailed
-- about a given (activity, sender) conversation, and which message that
-- notification was about — used to skip re-notifying inside a 15-minute
-- window unless the recipient has since read that earlier message.
create table if not exists message_notification_state (
  activity_id uuid not null references activities(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  last_notified_at timestamptz,
  last_notified_message_id uuid references messages(id) on delete set null,
  primary key (activity_id, sender_id, recipient_id)
);

alter table message_notification_state enable row level security;
-- Written only by the service-role key from /api/send-notification.js, so
-- no client-facing policies are needed — RLS with no policies denies all
-- anon/authenticated access by default, which is what we want here.

-- 3. Review-reminder dedup. One row per (activity, recipient) once a
-- "leave a review" email has gone out, so the cron sweep in
-- /api/review-reminders.js never sends the same person a second reminder
-- for the same activity.
create table if not exists review_reminder_state (
  activity_id uuid not null references activities(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (activity_id, recipient_id)
);

alter table review_reminder_state enable row level security;
-- Same as above — service-role only, no client policies.
