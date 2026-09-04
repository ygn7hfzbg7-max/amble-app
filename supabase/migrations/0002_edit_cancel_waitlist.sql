-- Edit lock, activity cancellation, and withdraw-with-waitlist-promotion.
--
-- Not applied automatically: paste this into the Supabase SQL editor for
-- your project, same as 0001_notifications.sql. Also requires adding
-- `activities` (UPDATE) to the Database Webhook that already posts
-- `requests`/`messages` events to /api/send-notification.js — see the
-- README for details.

-- 1. Activity status. Hosts can cancel their own activity at any time;
-- cancelled activities are filtered out of the feed and can no longer
-- accept new requests (see the requests-insert trigger below). Existing
-- rows default to 'active'.
alter table activities
  add column if not exists status text not null default 'active';

alter table activities drop constraint if exists activities_status_check;
alter table activities
  add constraint activities_status_check check (status in ('active', 'cancelled'));

-- 2. requests.status gains 'cancelled' — used both when a host cancels an
-- activity (bulk-applied to its pending/accepted requests) and when a
-- traveller withdraws their own accepted request — alongside the existing
-- pending/accepted/declined/waitlisted values. Whatever this app's status
-- check constraint is currently named, find and drop it first so this
-- doesn't silently no-op against a stricter constraint from elsewhere.
do $$
declare
  con record;
begin
  for con in
    select pgc.conname
    from pg_constraint pgc
    join pg_class rel on rel.oid = pgc.conrelid
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(pgc.conkey)
    where rel.relname = 'requests'
      and pgc.contype = 'c'
      and att.attname = 'status'
  loop
    execute format('alter table requests drop constraint %I', con.conname);
  end loop;

  alter table requests
    add constraint requests_status_check
    check (status in ('pending', 'accepted', 'declined', 'waitlisted', 'cancelled'));
end $$;

-- 3. Edit lock. Once at least one request on an activity is 'accepted',
-- the fields that define the actual commitment (when/where/what/how many)
-- can no longer change — title and description stay editable regardless.
-- This is enforced here, not just disabled in the UI, so a direct API call
-- can't work around it. security definer + fixed search_path so the check
-- itself doesn't depend on the acting role's own SELECT access to
-- `requests` (standard pattern for integrity-checking trigger functions).
create or replace function enforce_activity_edit_lock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  has_accepted boolean;
begin
  select exists (
    select 1 from requests where activity_id = old.id and status = 'accepted'
  ) into has_accepted;

  if has_accepted and (
    new.starts_at is distinct from old.starts_at
    or new.meet_point is distinct from old.meet_point
    or new.city is distinct from old.city
    or new.country is distinct from old.country
    or new.latitude is distinct from old.latitude
    or new.longitude is distinct from old.longitude
    or new.type is distinct from old.type
    or new.spots_total is distinct from old.spots_total
  ) then
    raise exception 'Can''t change date/time, location, category, or capacity once someone has accepted — cancel the activity instead.';
  end if;

  return new;
end;
$$;

drop trigger if exists activities_edit_lock on activities;
create trigger activities_edit_lock
  before update on activities
  for each row
  execute function enforce_activity_edit_lock();

-- 4. Travellers can withdraw their own accepted request themselves — the
-- existing "host can update status of requests on their activities" policy
-- covers accept/decline of other people's requests, but not this. Scoped
-- tightly: only accepted -> cancelled, only your own row, so it can't be
-- used to self-accept or touch anyone else's request.
drop policy if exists "Travellers can withdraw their own accepted request" on requests;
create policy "Travellers can withdraw their own accepted request"
  on requests for update
  using (traveller_id = auth.uid() and status = 'accepted')
  with check (traveller_id = auth.uid() and status = 'cancelled');

-- 5. Waitlist promotion. The moment an accepted request is withdrawn
-- (status accepted -> cancelled — via the policy above, or as part of a
-- host's bulk cancel of the whole activity), bump the oldest still-
-- waitlisted request on the same activity to 'accepted'. security definer
-- because the traveller doing the withdrawing has no RLS permission to
-- update someone else's request row directly; this is the one place that
-- cross-row update is allowed to happen.
--
-- Guarded on the activity still being 'active': this trigger also fires
-- when a host's bulk cancel flips a batch of accepted requests to
-- cancelled in one statement, and without this check it would "promote"
-- a waitlisted request on an activity that's being cancelled out from
-- under it — into a request that's about to get cancelled itself a
-- moment later, but not before an "accepted" notification email has
-- already gone out to that person. The client sets activities.status =
-- 'cancelled' (committed) before it bulk-cancels requests, so by the
-- time this trigger runs during that bulk update, the check below
-- reliably sees 'cancelled' and skips promotion — not a race.
create or replace function promote_next_waitlisted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_request_id uuid;
  activity_status text;
begin
  select status into activity_status from activities where id = old.activity_id;
  if activity_status is distinct from 'active' then
    return new;
  end if;

  select id into next_request_id
  from requests
  where activity_id = old.activity_id and status = 'waitlisted'
  order by created_at asc
  limit 1;

  if next_request_id is not null then
    update requests set status = 'accepted' where id = next_request_id;
  end if;

  return new;
end;
$$;

drop trigger if exists requests_promote_waitlist on requests;
create trigger requests_promote_waitlist
  after update on requests
  for each row
  when (old.status = 'accepted' and new.status = 'cancelled')
  execute function promote_next_waitlisted();

-- 6. Belt-and-braces: block a new request from landing on an activity
-- that's already cancelled. The client already hides the "request to
-- join" button once cancelled, but a stale page or a direct API call
-- shouldn't be able to route around that.
create or replace function block_requests_on_cancelled_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  activity_status text;
begin
  select status into activity_status from activities where id = new.activity_id;
  if activity_status = 'cancelled' then
    raise exception 'This activity was cancelled — you can no longer request to join it.';
  end if;
  return new;
end;
$$;

drop trigger if exists requests_block_on_cancelled_activity on requests;
create trigger requests_block_on_cancelled_activity
  before insert on requests
  for each row
  execute function block_requests_on_cancelled_activity();
