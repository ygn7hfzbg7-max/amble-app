# Amble — starter scaffold

A minimal working skeleton for the "join someone's Saturday" concept:
auth, post an activity, browse/request to join. Built with React + Vite +
Supabase. This is intentionally bare — chat, reviews, verification tiers,
and the review flow from the design prototype still need to be wired in.

## What's here
- `src/pages/Login.jsx` — magic-link email login
- `src/pages/Feed.jsx` — browse activities
- `src/pages/PostActivity.jsx` — locals post an activity
- `src/pages/EditActivity.jsx` — host edits or cancels an activity; date/time,
  location, category, and spots lock once someone has accepted (title and
  description stay editable) — see `supabase/migrations/0002_edit_cancel_waitlist.sql`
- `src/pages/ActivityDetail.jsx` — view an activity, request to join or withdraw
  (travellers), or jump to the requests list / edit (hosts); shows the confirmed
  match once accepted
- `src/pages/MyPlans.jsx` — unified chronological view of everything you're
  hosting or have requested to join, with a banner for pending join requests
- `src/pages/PendingRequests.jsx` — accept/decline every pending join
  request across all the activities you host, in one place
- `src/pages/ActivityRequests.jsx` — host view: see who requested to join
  a single activity, their profile info, and accept/decline
- `src/pages/Profile.jsx` — profile + sign out
- `src/pages/EditProfile.jsx` — set display name, city, and bio
- `src/lib/supabaseClient.js` — Supabase setup + suggested table schema (as SQL comments)
- `api/send-notification.js` — Vercel serverless function; Supabase Database Webhooks
  on `requests`/`messages` POST here to trigger Resend emails (new join request,
  accepted/declined, new chat message)
- `api/review-reminders.js` — Vercel Cron target that emails hosts/travellers to
  review each other once an activity's start time has passed

## Setup

1. Create a free project at https://supabase.com
2. In the SQL editor, create the tables described in
   `src/lib/supabaseClient.js` (profiles, activities, requests, reviews),
   and enable Row Level Security with appropriate policies. If you created
   these tables before the host-side screens were added, you'll need to:
   - add an `email text` column to `profiles`
   - add a policy letting a host update the `status` of requests on their
     own activities (needed for accept/decline)
   - add a policy letting any authenticated user read `profiles` (needed
     so a host can see who requested to join)
   - add a policy letting a user insert/update only their own `profiles`
     row (`id = auth.uid()`) — used by the profile edit screen and by the
     app's automatic profile-row creation on login
3. Copy `.env.example` to `.env` and fill in your Supabase URL + anon key
   from Project Settings > API.
4. Install dependencies and run:

   ```
   npm install
   npm run dev
   ```

5. Open the local URL it prints (usually http://localhost:5173).

## Email notifications

Transactional emails (new join request, accepted/declined, new chat
message, review reminders) go through Resend, sent from Vercel serverless
functions under `/api`. Setup is split across three places:

1. **Vercel env vars** — `RESEND_API_KEY` (already set in Production),
   plus `SUPABASE_SERVICE_ROLE_KEY`, `PUBLIC_APP_URL`, and optionally
   `RESEND_FROM_EMAIL`, `SUPABASE_WEBHOOK_SECRET`, `CRON_SECRET` — see
   `.env.example` for what each does.
2. **Supabase SQL editor** — run `supabase/migrations/0001_notifications.sql`
   (adds `profiles.notifications_enabled` and two small dedup tables) and
   `supabase/migrations/0002_edit_cancel_waitlist.sql` (activity
   cancellation, the edit lock on core commitment fields, and automatic
   waitlist promotion on withdrawal).
3. **Supabase Database Webhooks** — configured by hand in the dashboard;
   see the full step-by-step in the PR description for this feature. The
   webhook posting to `/api/send-notification.js` needs to cover UPDATE
   events on `activities` too (not just `requests`/`messages`) so hosts'
   title/description edits notify already-accepted participants.

## Suggested next steps (best done in Claude Code)
- Add the two-sided review screen after an activity
- Add the three-tier verification system from the design prototype
- Add basic chat once a request is accepted
- Style pass to match the ticket-stub visual identity from the prototype
- Eventually: wrap as a mobile app (Capacitor or React Native) before
  considering the App Store — stay on web for testing as long as possible
