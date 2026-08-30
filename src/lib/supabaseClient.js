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
    avatar_url    text
    tier          text   default 'Basic'   -- Basic | Verified | Trusted
    created_at    timestamptz default now()

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
    created_at    timestamptz default now()

  requests
    id            uuid primary key default gen_random_uuid()
    activity_id   uuid references activities.id
    traveller_id  uuid references profiles.id
    status        text default 'pending'   -- pending | accepted | declined | waitlisted
    created_at    timestamptz default now()

  reviews
    id            uuid primary key default gen_random_uuid()
    activity_id   uuid references activities.id
    from_id       uuid references profiles.id
    to_id         uuid references profiles.id
    rating        int
    tags          text[]
    note          text
    created_at    timestamptz default now()

  Enable Row Level Security on all tables and add policies so:
  - anyone can read activities
  - only the host can insert/update their own activities
  - only the traveller can insert their own requests
  - the host of the activity a request belongs to can update that
    request's status (needed for the accept/decline screen)
  - any authenticated user can read profiles (needed so a host can see who
    requested to join, and a traveller can see their own confirmed match)
  - a user can insert/update only their own profiles row (id = auth.uid()),
    which is what the "ensureProfile" upsert above and the profile edit
    screen rely on
  - only participants in an activity can insert a review about each other
*/
