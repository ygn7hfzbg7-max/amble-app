# Amble — starter scaffold

A minimal working skeleton for the "join someone's Saturday" concept:
auth, post an activity, browse/request to join. Built with React + Vite +
Supabase. Chat, reviews, and layer 1 of verification (email + phone tiers)
are wired in; later verification layers (ID checks, live location sharing)
still need to be.

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
- `src/pages/Verification.jsx` — current verification tier, progress toward the
  next one, and the phone number + SMS OTP flow
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
   `profiles.verification_tier`/`phone`/`phone_verified_at`, the phone
   confirmation + automatic tier-upgrade functions, and the category
   gating triggers). See "Verification tiers & phone auth" below — phone
   verification needs a bit of manual setup in the Supabase dashboard
   before it'll actually send SMS.
4. Copy `.env.example` to `.env` and fill in your Supabase URL + anon key
   from Project Settings > API.
5. Install dependencies and run:

   ```
   npm install
   npm run dev
   ```

6. Open the local URL it prints (usually http://localhost:5173).

## Verification tiers & phone auth

Layer 1 of the verification system: `profiles.verification_tier` is
`unverified` (email only) → `basic` (phone confirmed) → `verified` (basic +
2 completed activities with visible, good reviews — upgraded automatically,
no action needed). Sport and Outdoors activities require `basic` to host or
join, since they can be more physically remote or isolating; every other
category stays open to a brand-new sign-up. See `src/lib/verification.js`
for the category map and `supabase/migrations/0003_verification_tier.sql`
for the full mechanics (tier transitions are locked to a handful of
SECURITY DEFINER functions — a client can't just PATCH its own row to
`verified`).

Phone verification uses Supabase's own phone auth (SMS OTP) rather than a
separate SMS integration — but Supabase doesn't send SMS itself, so this
needs one-time manual setup that isn't done by this PR:

1. **A Twilio account** (or another SMS provider Supabase supports — Vonage
   and MessageBird also work). Twilio is the most commonly used with
   Supabase: create an account, buy a phone number capable of sending SMS,
   and note the Account SID, Auth Token, and Messaging Service SID (or the
   "From" number).
2. **Enable phone auth in Supabase** — Authentication → Providers → Phone,
   turn it on, choose Twilio as the SMS provider, and paste in the
   credentials from step 1. "Confirm phone number" should stay on so an OTP
   is required.
3. Run `supabase/migrations/0003_verification_tier.sql` (see Setup above)
   if you haven't already.

Nothing else is required client-side — `src/pages/Verification.jsx` calls
`supabase.auth.updateUser({ phone })` to send the code and
`supabase.auth.verifyOtp({ phone, token, type: 'phone_change' })` to confirm
it, both of which just need phone auth enabled as above.

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
  on top of the email/phone/track-record tiers already in place
- Add basic chat once a request is accepted
- Style pass to match the ticket-stub visual identity from the prototype
- Eventually: wrap as a mobile app (Capacitor or React Native) before
  considering the App Store — stay on web for testing as long as possible
