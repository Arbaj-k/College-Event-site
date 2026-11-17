-- College-scoped OneSignal push delivery for Connect Board posts.
create table if not exists public.campus_push_deliveries (
  post_id uuid primary key references public.campus_posts(id) on delete cascade,
  college_id uuid not null references public.colleges(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent')),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  onesignal_notification_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists campus_push_deliveries_college_created_idx
  on public.campus_push_deliveries (college_id, created_at desc);

alter table public.campus_push_deliveries enable row level security;
-- No client policies: only the service-role Edge Function can read/write delivery claims.
