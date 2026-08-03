# Amble — starter scaffold

A minimal working skeleton for the "join someone's Saturday" concept:
auth, post an activity, browse/request to join. Built with React + Vite +
Supabase. This is intentionally bare — chat, reviews, verification tiers,
and the review flow from the design prototype still need to be wired in.

## What's here
- `src/pages/Login.jsx` — magic-link email login
- `src/pages/Feed.jsx` — browse activities
- `src/pages/PostActivity.jsx` — locals post an activity
- `src/pages/ActivityDetail.jsx` — view + request to join
- `src/pages/Profile.jsx` — bare profile + sign out
- `src/lib/supabaseClient.js` — Supabase setup + suggested table schema (as SQL comments)

## Setup

1. Create a free project at https://supabase.com
2. In the SQL editor, create the tables described in
   `src/lib/supabaseClient.js` (profiles, activities, requests, reviews),
   and enable Row Level Security with appropriate policies.
3. Copy `.env.example` to `.env` and fill in your Supabase URL + anon key
   from Project Settings > API.
4. Install dependencies and run:

   ```
   npm install
   npm run dev
   ```

5. Open the local URL it prints (usually http://localhost:5173).

## Suggested next steps (best done in Claude Code)
- Wire up the `requests` accept/decline flow for hosts
- Add the two-sided review screen after an activity
- Add the three-tier verification system from the design prototype
- Add basic chat once a request is accepted
- Style pass to match the ticket-stub visual identity from the prototype
- Eventually: wrap as a mobile app (Capacitor or React Native) before
  considering the App Store — stay on web for testing as long as possible
