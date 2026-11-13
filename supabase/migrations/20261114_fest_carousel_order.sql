-- Persist mixed fest-photo/activity-poster ordering without changing existing content.
begin;
alter table public.fests add column if not exists carousel_order jsonb not null default '[]'::jsonb;
do $$
begin
 if not exists (select 1 from pg_constraint where conname='fests_carousel_order_is_array' and conrelid='public.fests'::regclass) then
  alter table public.fests add constraint fests_carousel_order_is_array check (jsonb_typeof(carousel_order)='array');
 end if;
end $$;
comment on column public.fests.carousel_order is 'Ordered keys: photo:<URL> and activity:<activity UUID or poster URL>; empty preserves legacy default order.';
commit;