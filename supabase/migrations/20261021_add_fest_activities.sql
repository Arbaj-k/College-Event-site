alter table public.fests
  add column if not exists activities jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fests_activities_array_max_20'
      and conrelid = 'public.fests'::regclass
  ) then
    alter table public.fests
      add constraint fests_activities_array_max_20
      check (
        jsonb_typeof(activities) = 'array'
        and jsonb_array_length(activities) <= 20
      );
  end if;
end
$$;
