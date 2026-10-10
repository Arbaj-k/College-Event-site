-- Make every event content field optional while preserving existing records.
alter table public.events
  alter column title drop not null,
  alter column venue drop not null,
  alter column organizer drop not null,
  alter column category drop not null,
  alter column short_description drop not null,
  alter column registration_link drop not null;

alter table public.events
  drop constraint if exists events_title_check,
  drop constraint if exists events_venue_check,
  drop constraint if exists events_organizer_check,
  drop constraint if exists events_category_check,
  drop constraint if exists events_short_description_check,
  drop constraint if exists events_registration_link_check,
  drop constraint if exists deadline_not_after_event;

alter table public.events
  add constraint events_title_check check (title is null or char_length(title) <= 120),
  add constraint events_venue_check check (venue is null or char_length(venue) <= 120),
  add constraint events_organizer_check check (organizer is null or char_length(organizer) <= 120),
  add constraint events_short_description_check check (short_description is null or char_length(short_description) <= 200),
  add constraint events_registration_link_check check (registration_link is null or registration_link ~* '^https://'),
  add constraint deadline_not_after_event check (registration_deadline is null or "date" is null or registration_deadline <= "date");
