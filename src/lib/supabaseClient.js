import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Makes sure the signed-in user has a profiles row, so hosts always have
// something to look up when a request comes in. Only sets id/email — an
// upsert like this never clobbers a display_name/city/bio the user already
// saved from the profile edit screen.
export async function ensureProfile(user) {
  if (!user) return;
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, email: user.email }, { onConflict: "id" });
  if (error) console.error("Couldn't sync profile:", error.message);
}

/*
  Suggested tables (create these in Supabase's SQL editor):

  profiles
    id            uuid  (references auth.users.id, primary key)
    email         text
    display_name  text
    city          text
    bio           text
    languages     text          -- free text, e.g. "English, Spanish"
    avatar_url    text          -- public URL of the file in the "avatars" Storage bucket
    notifications_enabled boolean default true  -- checked before any notification
                                                    -- email is sent; see api/_lib and
                                                    -- supabase/migrations/0001_notifications.sql
    verification_tier  text not null default 'unverified'  -- unverified | basic | verified —
                                          -- email-only, +phone confirmed, +track record;
                                          -- only changes via the SECURITY DEFINER functions
                                          -- in supabase/migrations/0003_verification_tier.sql,
                                          -- never a direct client update — see that file
    phone               text          -- set only by confirm_phone_verification(), mirrored
                                          -- from auth.users.phone once OTP-confirmed
    phone_verified_at   timestamptz   -- set only by confirm_phone_verification()
    created_at    timestamptz default now()

    "email" is stored for account/auth purposes only — never render it as a
    user-facing label. Anywhere a person's name is shown, use display_name
    with a neutral fallback ("Amble member") instead; see
    src/lib/profileDisplay.js.

  activities
    id            uuid  primary key default gen_random_uuid()
    host_id       uuid  references profiles.id
    type          text          -- Hike | Food | Walk
    title         text
    description   text
    meet_point    text          -- human-readable meeting note, e.g. "by the north gate"
    city          text          -- from the place picker, shown in listings + to unconfirmed viewers
    country       text
    latitude      numeric(10, 7) -- nullable — older activities may have no coordinates
    longitude     numeric(10, 7)
    starts_at     timestamptz
    spots_total   int
    fee           numeric default 0
    currency      text default 'GBP'   -- ISO 4217 code, e.g. 'GBP' | 'EUR' | 'USD' — set
                                          -- by the host when posting; never converted, since
                                          -- the fee is paid in person in this currency
    status        text not null default 'active'   -- active | cancelled — see
                                          -- supabase/migrations/0002_edit_cancel_waitlist.sql
    created_at    timestamptz default now()

    spots_total already doubles as the activity's capacity/waitlist threshold —
    once accepted-request-count >= spots_total, new requests land as
    'waitlisted' instead of 'pending' (see requests.status below).

    Once any request on an activity is 'accepted', a database trigger
    (enforce_activity_edit_lock, in the migration above) blocks changes to
    starts_at / meet_point / city / country / latitude / longitude / type /
    spots_total — the fields that define what someone actually signed up
    for. title and description stay editable regardless. The only way to
    change a locked field once someone's committed is to cancel (status ->
    'cancelled') and, if it's still worth doing, post it again.

    Some categories (currently Sport, Outdoors — see CATEGORY_MIN_TIER in
    src/lib/verification.js) require the host to be at least 'basic'
    verification_tier; enforced client-side and, belt-and-braces, by the
    enforce_activity_host_tier trigger in
    supabase/migrations/0003_verification_tier.sql on insert or a change
    to `type`.

  requests
    id            uuid primary key default gen_random_uuid()
    activity_id   uuid references activities.id
    traveller_id  uuid references profiles.id
    status        text default 'pending'   -- pending | accepted | declined | waitlisted | cancelled
    created_at    timestamptz default now()

    'cancelled' covers two distinct flows, both landing on the same
    status: a host cancelling the whole activity (bulk-updates every
    pending/accepted/waitlisted request) and a traveller withdrawing their
    own accepted request individually. A database trigger
    (promote_next_waitlisted) reacts to an accepted -> cancelled
    transition by auto-promoting the oldest 'waitlisted' request on that
    same activity to 'accepted' — but only when the activity is still
    'active', so a host's bulk cancel doesn't "promote" someone into a
    request that's about to be cancelled itself a moment later.

    Same tier gating as activities.type above, from the traveller's side:
    enforce_request_traveller_tier blocks the insert if the activity's
    category needs a verification_tier the traveller doesn't have yet.

  reviews
    id            uuid primary key default gen_random_uuid()
    activity_id   uuid references activities.id
    reviewer_id   uuid references profiles.id   -- who wrote the review
    reviewee_id   uuid references profiles.id   -- who it's about
    rating        int                            -- 1-5
    tags          text[]                         -- structured tags, direction-specific
    note          text                           -- optional free text
    created_at    timestamptz default now()
    visible_at    timestamptz                    -- server-set: activities.starts_at + 14 days;
                                                   -- the *deadline*, not a toggle — a review also
                                                   -- becomes readable the moment its counterpart
                                                   -- (same activity, reviewer/reviewee swapped) exists,
                                                   -- via the read RLS policy below, so nothing needs
                                                   -- to flip this column early. One row per
                                                   -- (activity_id, reviewer_id, reviewee_id) — see the
                                                   -- full migration (table + trigger + RLS) in the PR
                                                   -- description for this feature.

    Only possible between people an accepted "requests" row actually
    matched on that activity (host <-> that confirmed traveller), and only
    once the activity's starts_at has passed. Hidden until both sides have
    submitted or the 14-day window closes — see visible_at above.

  messages
    id            uuid primary key default gen_random_uuid()
    activity_id   uuid references activities.id
    sender_id     uuid references profiles.id
    recipient_id  uuid references profiles.id
    body          text
    created_at    timestamptz default now()
    read_at       timestamptz  -- null until the recipient opens the thread

    One row per 1:1 message between a host and a specific confirmed
    traveller on one activity — chat only unlocks once a request between
    them is "accepted"; see the SQL migration for the exact table + RLS
    policies this app relies on.

  Enable Row Level Security on all tables and add policies so:
  - anyone can read activities
  - only the host can insert/update their own activities (the
    enforce_activity_edit_lock trigger further restricts which columns
    that update policy can actually change once someone's accepted — see
    supabase/migrations/0002_edit_cancel_waitlist.sql)
  - only the traveller can insert their own requests, and a trigger blocks
    that insert outright if the activity has already been cancelled
  - the host of the activity a request belongs to can update that
    request's status (needed for the accept/decline screen, and for the
    bulk pending/accepted/waitlisted -> cancelled update when the host
    cancels the whole activity)
  - a traveller can update their own request from 'accepted' to
    'cancelled' (withdrawing) — nothing else; a trigger reacts to that by
    auto-promoting the oldest waitlisted request on the same activity
  - any authenticated user can read profiles (needed so a host can see who
    requested to join, and a traveller can see their own confirmed match)
  - a user can insert/update only their own profiles row (id = auth.uid()),
    which is what the "ensureProfile" upsert above and the profile edit
    screen rely on — verification_tier/phone/phone_verified_at are further
    locked down on top of that by the profiles_verification_columns_locked
    trigger, see supabase/migrations/0003_verification_tier.sql
  - a review can only be inserted by its reviewer, about the activity's
    other confirmed party (host <-> that accepted traveller — nobody
    else), and only once the activity has started; editable by its
    reviewer until it becomes visible, then locked; readable by anyone
    once visible (both sides submitted, or 14 days after starts_at),
    otherwise only by its own reviewer — see the reviews migration for
    the exact policies and the review_is_visible() helper function
  - a user can read a message only if they are its sender or recipient
  - a user can insert a message only as themselves, and only when an
    accepted request links them to the other party on that activity
    (host <-> that confirmed traveller — nobody else)
  - a user can update only the read_at column, and only on messages sent
    to them (marking a thread as read)

  Email notifications (new join request, request accepted/declined, new
  chat message, review reminder) are sent by serverless functions under
  /api, triggered by Supabase Database Webhooks on requests/messages and a
  Vercel Cron sweep for review reminders — see
  supabase/migrations/0001_notifications.sql for the two extra tables that
  back debouncing/dedup, and the PR description for the exact webhook
  setup steps.
*/
