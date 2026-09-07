-- Report/flag feature: lets a host or traveller flag a concern about the
-- other party on an active match. Write-only from the client on purpose —
-- see the RLS policy below.
--
-- Not applied automatically: paste this into the Supabase SQL editor for
-- your project, same as the earlier migrations. See the PR description for
-- the accompanying Database Webhook step (POST to
-- /api/send-notification.js on INSERT) and the REPORT_NOTIFICATION_EMAIL
-- env var that email goes to.

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  reported_user_id uuid not null references profiles(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  reason text not null check (reason in ('no_show', 'felt_unsafe', 'inappropriate_behavior', 'other')),
  details text,
  created_at timestamptz not null default now()
);

create index if not exists reports_activity_id_idx on reports(activity_id);
create index if not exists reports_reported_user_id_idx on reports(reported_user_id);

alter table reports enable row level security;

-- Insert-only, and only by the reporter, about someone they actually have
-- (or had) an accepted match with on that activity — host <-> that
-- confirmed traveller, same relationship messages/reviews are gated on.
-- There is deliberately NO select policy: RLS with no read policy denies
-- all anon/authenticated reads by default, so a submitted report is only
-- ever readable via direct Supabase access (service role / SQL editor),
-- never through the app itself. Don't add a read policy here — if an
-- in-app admin view is ever built, it should go through a SECURITY DEFINER
-- RPC restricted to specific admin accounts, not a table-level policy that
-- would let any authenticated user query other people's reports.
create policy "reports_insert_own_match" on reports
  for insert
  to authenticated
  with check (
    reporter_id = auth.uid()
    and reported_user_id <> auth.uid()
    and exists (
      select 1
      from activities a
      join requests r on r.activity_id = a.id and r.status = 'accepted'
      where a.id = activity_id
        and (
          (a.host_id = reporter_id and r.traveller_id = reported_user_id)
          or (a.host_id = reported_user_id and r.traveller_id = reporter_id)
        )
    )
  );
