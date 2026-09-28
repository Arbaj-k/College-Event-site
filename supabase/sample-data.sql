-- =====================================================================
--  Hapn – 5 sample events (run ONCE, after schema.sql)
--  Posters point to the placeholder images in assets/images/.
--  Replace registration links with your real Google Form URLs
--  (see the README, section "Replacing the sample data").
-- =====================================================================
insert into public.events
  (title, poster_url, "date", "time", venue, organizer, category,
   short_description, description, registration_deadline, registration_link)
values
  ('Coding Competition 2026',
   'assets/images/poster-coding.svg', '2026-09-28', '14:00', 'Computer Lab', 'Computer Science Society', 'Technical',
   'Solve algorithm and logic challenges against the clock and win prizes.',
   E'A 3-hour individual coding contest with problems for beginners and advanced coders.\n\nBring your student ID. Laptops are provided in the lab; you may use C, C++, Java or Python.\n\nTop three participants receive certificates and prizes.',
   '2026-09-26', 'https://forms.gle/REPLACE_WITH_FORM_ID_1'),

  ('UI/UX Design Workshop',
   'assets/images/poster-design.svg', '2026-10-03', '10:30', 'Seminar Hall A', 'Design Club', 'Workshop',
   'A hands-on session on designing your first mobile app screens.',
   E'Learn the basics of user research, wireframing and prototyping with free tools.\n\nNo design experience needed. Please bring a laptop with a modern browser.',
   '2026-10-01', 'https://forms.gle/REPLACE_WITH_FORM_ID_2'),

  ('CodeSprint 24-Hour Hackathon',
   'assets/images/poster-hackathon.svg', '2026-10-10', '09:00', 'Innovation Centre', 'Tech Council', 'Hackathon',
   'Team up, build a project in 24 hours and pitch it to a panel of judges.',
   E'Teams of 2 to 4 students build a working prototype around the theme announced on the day.\n\nSnacks and dinner are provided. Mentors from local companies will be available throughout.',
   '2026-10-08', 'https://forms.gle/REPLACE_WITH_FORM_ID_3'),

  ('Rangotsav Cultural Night',
   'assets/images/poster-cultural.svg', '2026-10-17', '17:30', 'Open Air Auditorium', 'Cultural Committee', 'Cultural',
   'An evening of music, dance, drama and food stalls run by students.',
   E'Performances from every department, plus a food court and a photo booth.\n\nRegister if you want to perform. Everyone is welcome to attend as an audience member.',
   '2026-10-15', 'https://forms.gle/REPLACE_WITH_FORM_ID_4'),

  ('Placement Prep: Resume and Interview Skills',
   'assets/images/poster-career.svg', '2026-10-24', '11:00', 'Main Auditorium', 'Training and Placement Cell', 'Career',
   'Alumni recruiters share resume tips and run live mock interviews.',
   E'Get your resume reviewed, learn how to answer common interview questions and ask recruiters anything.\n\nOpen to final-year and pre-final-year students.',
   '2026-10-22', 'https://forms.gle/REPLACE_WITH_FORM_ID_5');
