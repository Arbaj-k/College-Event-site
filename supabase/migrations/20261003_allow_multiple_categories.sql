-- Allow the admin form to save comma-separated multi-category values and custom Other names.
-- The frontend validates that at least one category is selected.
alter table public.events drop constraint if exists events_category_check;
alter table public.events
  add constraint events_category_not_blank
  check (char_length(trim(category)) > 0);
