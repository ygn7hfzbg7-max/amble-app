import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/*
  Suggested tables (create these in Supabase's SQL editor):

  profiles
    id            uuid  (references auth.users.id, primary key)
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
    meet_point    text
    starts_at     timestamptz
    spots_total   int
    fee           numeric default 0
    created_at    timestamptz default now()

  requests
    id            uuid primary key default gen_random_uuid()
    activity_id   uuid references activities.id
    traveller_id  uuid references profiles.id
    status        text default 'pending'   -- pending | accepted | declined
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
  - only participants in an activity can insert a review about each other
*/
