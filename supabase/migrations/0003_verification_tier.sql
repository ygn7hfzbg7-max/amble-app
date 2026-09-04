-- Verification tier system, layer 1: a tier field on profiles, phone number
-- + SMS OTP verification, and category gating for hosting/joining.
--
-- "Verified" here means email + phone confirmed plus a track record — not
-- government ID or live location sharing, which are later layers of this
-- same system.
--
-- Not applied automatically: paste this into the Supabase SQL editor for
-- your project, same as the earlier migrations. Also requires enabling
-- phone auth (Twilio) in Supabase Auth settings — see the PR description
-- for the exact manual steps.

-- 1. Tier + phone columns on profiles. Existing rows default to
-- 'unverified' — nobody is retroactively upgraded or downgraded, and
-- nothing here touches already-accepted requests or already-posted
-- activities (the gating triggers in section 7 only fire on *new*
-- inserts/type changes, never on existing rows).
alter table profiles
  add column if not exists verification_tier text not null default 'unverified';

alter table profiles drop constraint if exists profiles_verification_tier_check;
alter table profiles
  add constraint profiles_verification_tier_check
  check (verification_tier in ('unverified', 'basic', 'verified'));

alter table profiles add column if not exists phone text;
alter table profiles add column if not exists phone_verified_at timestamptz;

-- 2. Lock verification_tier / phone / phone_verified_at to the SECURITY
-- DEFINER functions below. The existing "users can update their own
-- profile" RLS policy is row-level only (no column restrictions), so
-- without this a client could otherwise PATCH their own row straight to
-- verification_tier = 'verified'. confirm_phone_verification() and
-- refresh_verification_tier() each set this flag (transaction-local, so it
-- never leaks across requests) immediately before the one write they're
-- allowed to make; any other attempt to change these three columns is
-- rejected.
create or replace function enforce_verification_columns_locked()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (
    new.verification_tier is distinct from old.verification_tier
    or new.phone is distinct from old.phone
    or new.phone_verified_at is distinct from old.phone_verified_at
  ) and coalesce(current_setting('amble.tier_change_allowed', true), '') <> 'true' then
    raise exception 'verification_tier, phone, and phone_verified_at can only change via phone verification or the automatic track-record upgrade.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_verification_columns_locked on profiles;
create trigger profiles_verification_columns_locked
  before update on profiles
  for each row
  execute function enforce_verification_columns_locked();

-- 3. Confirm phone verification. Called by the client right after
-- supabase.auth.verifyOtp({ phone, token, type: 'phone_change' }) succeeds.
-- Doesn't trust the client's say-so that the phone is verified — it reads
-- the confirmation straight off auth.users, which only Supabase Auth's own
-- OTP flow can set. Upgrades unverified -> basic; never touches someone
-- already at 'verified'.
create or replace function confirm_phone_verification()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  confirmed_phone text;
  confirmed_at timestamptz;
begin
  select phone, phone_confirmed_at into confirmed_phone, confirmed_at
  from auth.users
  where id = auth.uid();

  if confirmed_phone is null or confirmed_at is null then
    raise exception 'No confirmed phone number found for this account yet.';
  end if;

  perform set_config('amble.tier_change_allowed', 'true', true);
  update profiles
  set
    phone = confirmed_phone,
    phone_verified_at = confirmed_at,
    verification_tier = case when verification_tier = 'unverified' then 'basic' else verification_tier end
  where id = auth.uid();
end;
$$;

-- 4. Track-record threshold for 'verified': 2+ activities where this person
-- was reviewed with a decent rating (4-5 stars) on a review that's actually
-- visible to others — the same visibility rule the reviews RLS policy uses
-- (review_is_visible): visible once its 14-day window has passed, or as
-- soon as the counterpart review (same activity, roles swapped) exists.
-- Keep the "2" and "4" here in sync with VERIFIED_TRACK_RECORD_THRESHOLD /
-- VERIFIED_DECENT_RATING in src/lib/verification.js, and the 14-day window
-- with REVIEW_WINDOW_DAYS in src/lib/reviews.js, if those ever change.
create or replace function count_verified_track_record(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(distinct r.activity_id)::integer
  from reviews r
  where r.reviewee_id = p_user_id
    and r.rating >= 4
    and (
      r.visible_at <= now()
      or exists (
        select 1 from reviews counterpart
        where counterpart.activity_id = r.activity_id
          and counterpart.reviewer_id = r.reviewee_id
          and counterpart.reviewee_id = r.reviewer_id
      )
    );
$$;

-- 5. Recompute + apply the tier upgrade for one user. basic -> verified
-- only (verified requires phone confirmed first, i.e. already basic); never
-- downgrades, and does nothing for an unverified user regardless of review
-- count until they verify their phone.
create or replace function refresh_verification_tier(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select verification_tier from profiles where id = p_user_id) = 'basic'
     and count_verified_track_record(p_user_id) >= 2 then
    perform set_config('amble.tier_change_allowed', 'true', true);
    update profiles set verification_tier = 'verified' where id = p_user_id;
  end if;
end;
$$;

-- 6. A review crossing the threshold is the main event that can promote
-- someone to 'verified', so recompute on every insert/update of a review
-- about them. This won't catch a review's *passive* 14-day-elapses-with-
-- no-new-write visibility change (nothing is written to the DB at that
-- moment) — get_my_verification_status() below covers that case whenever
-- the person next opens the Verification screen.
create or replace function reviews_refresh_verification_tier()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform refresh_verification_tier(new.reviewee_id);
  return new;
end;
$$;

drop trigger if exists reviews_refresh_verification_tier on reviews;
create trigger reviews_refresh_verification_tier
  after insert or update on reviews
  for each row
  execute function reviews_refresh_verification_tier();

-- 7. Category gating. Keep required_tier_for_category in sync with
-- CATEGORY_MIN_TIER in src/lib/verification.js — the client already blocks
-- the action before it ever reaches the database; these triggers are
-- belt-and-braces so a direct API call can't route around it, the same
-- pattern as enforce_activity_edit_lock / block_requests_on_cancelled_activity
-- in 0002_edit_cancel_waitlist.sql. Error messages are prefixed
-- 'VERIFICATION_REQUIRED:' so the client can recognise them and show the
-- verification screen instead of a generic error banner.
--
-- Only fires on INSERT, or on UPDATE when `type` is actually changing —
-- editing title/description/etc. on an activity you already posted (in a
-- category you no longer meet the bar for, which can't actually happen
-- today since tiers never downgrade, but just in case) is never blocked.
create or replace function required_tier_for_category(p_category text)
returns text
language sql
immutable
as $$
  select case p_category
    when 'Sport' then 'basic'
    when 'Outdoors' then 'basic'
    else null
  end;
$$;

create or replace function tier_meets(p_tier text, p_required text)
returns boolean
language sql
immutable
as $$
  select p_required is null or (
    case p_tier when 'unverified' then 0 when 'basic' then 1 when 'verified' then 2 else 0 end
    >=
    case p_required when 'unverified' then 0 when 'basic' then 1 when 'verified' then 2 else 0 end
  );
$$;

create or replace function enforce_activity_host_tier()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  required text;
  host_tier text;
begin
  if tg_op = 'UPDATE' and new.type is not distinct from old.type then
    return new;
  end if;

  required := required_tier_for_category(new.type);
  if required is null then
    return new;
  end if;

  select verification_tier into host_tier from profiles where id = new.host_id;
  if not tier_meets(coalesce(host_tier, 'unverified'), required) then
    raise exception 'VERIFICATION_REQUIRED: Hosting a % activity needs % verification.', new.type, required;
  end if;

  return new;
end;
$$;

drop trigger if exists activities_enforce_host_tier on activities;
create trigger activities_enforce_host_tier
  before insert or update on activities
  for each row
  execute function enforce_activity_host_tier();

create or replace function enforce_request_traveller_tier()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  required text;
  activity_type text;
  traveller_tier text;
begin
  select type into activity_type from activities where id = new.activity_id;
  required := required_tier_for_category(activity_type);
  if required is null then
    return new;
  end if;

  select verification_tier into traveller_tier from profiles where id = new.traveller_id;
  if not tier_meets(coalesce(traveller_tier, 'unverified'), required) then
    raise exception 'VERIFICATION_REQUIRED: Joining a % activity needs % verification.', activity_type, required;
  end if;

  return new;
end;
$$;

drop trigger if exists requests_enforce_traveller_tier on requests;
create trigger requests_enforce_traveller_tier
  before insert on requests
  for each row
  execute function enforce_request_traveller_tier();

-- 8. Client-facing RPC for the Verification screen: refreshes the caller's
-- own tier (covers the passive 14-day case noted in section 6) and returns
-- everything the screen needs in one round trip.
create or replace function get_my_verification_status()
returns table (
  verification_tier text,
  phone text,
  phone_verified_at timestamptz,
  track_record_count integer,
  track_record_threshold integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform refresh_verification_tier(auth.uid());
  return query
    select p.verification_tier, p.phone, p.phone_verified_at,
           count_verified_track_record(auth.uid()), 2
    from profiles p
    where p.id = auth.uid();
end;
$$;

grant execute on function confirm_phone_verification() to authenticated;
grant execute on function get_my_verification_status() to authenticated;
