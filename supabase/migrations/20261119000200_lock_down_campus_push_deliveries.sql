-- Keep campus push delivery records service-role-only.
-- RLS without policies blocks row access, but does not block TRUNCATE;
-- remove direct table privileges from browser-facing roles entirely.
begin;

revoke all privileges on table public.campus_push_deliveries from anon;
revoke all privileges on table public.campus_push_deliveries from authenticated;

-- service_role retains its existing privileges for trusted server-side delivery.

commit;
