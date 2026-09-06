# Amble — starter scaffold

A minimal working skeleton for the "join someone's Saturday" concept:
auth, post an activity, browse/request to join. Built with React + Vite +
Supabase. Chat, reviews, and layer 1 of verification (tiers + track-record
gating) are wired in; later verification layers (ID checks, live location
sharing) still need to be.

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
- `src/pages/Verification.jsx` — current verification tier and progress
  toward the next one
- `src/lib/verification.js` — tier constants and the category gating map
  (which categories need `basic` to host/join)
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
3. Also run `supabase/migrations/0003_verification_tier.sql` (adds
   `profiles.verification_tier`, the automatic tier-upgrade functions, and
   the category gating triggers) — see "Verification tiers" below. No
   extra dashboard setup is needed for this one.
4. Copy `.env.example` to `.env` and fill in your Supabase URL + anon key
   from Project Settings > API.
5. Install dependencies and run:

   ```
   npm install
   npm run dev
   ```

6. Open the local URL it prints (usually http://localhost:5173).

## Verification tiers

Layer 1 of the verification system: `profiles.verification_tier` starts
everyone at `basic` (signing in at all already proves email ownership via
the magic-link flow, so there's no separate "unverified" state) and
upgrades to `verified` automatically once someone has 2 completed
activities with visible, good reviews — no action needed, no manual flag.
Sport and Outdoors activities are gated to require `basic` to host or join;
since that's everyone today, it's currently a no-op kept in place as
future-proofing (e.g. for a tier introduced below `basic` later, or a
category that ends up needing `verified` specifically). See
`src/lib/verification.js` for the category map and
`supabase/migrations/0003_verification_tier.sql` for the full mechanics
(tier transitions are locked to a handful of SECURITY DEFINER functions —
a client can't just PATCH its own row to `verified`).

There's no phone/SMS step in this layer and nothing to configure in the
Supabase dashboard for it.

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
- Layer 2+ of verification: government ID checks and live location sharing
  on top of the basic/verified tiers already in place
- Add basic chat once a request is accepted
- Style pass to match the ticket-stub visual identity from the prototype
- Eventually: wrap as a mobile app (Capacitor or React Native) before
  considering the App Store — stay on web for testing as long as possible
