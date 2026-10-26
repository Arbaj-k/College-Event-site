# Hapn Anonymous Chat — Development Setup

## Safety status
- This feature is isolated on branch `anonymous-chat-dev`.
- Do not merge this branch into `main` until reviewed and explicitly approved.
- `anonymous-chat-preview.html` is the UI-only prototype. `anonymous-chat-connected-preview.html` is the backend-connected test page; it uses automatic nicknames and background anonymous Supabase auth. It has not yet been end-to-end tested in a browser.
- The chat tables and RLS policies have been applied to Hapn's existing Supabase project `xeablvxtlxdwuiiawsgq`. `public.chat_messages` is also present in the `supabase_realtime` publication. Do not re-run the SQL draft as a migration.
- The repository is public, so files committed to this branch are publicly viewable. Do not add secrets, service-role keys, passwords, or private user data.

## Projects checked
The repository's existing Hapn configuration points to Supabase project `xeablvxtlxdwuiiawsgq`, which currently contains the Hapn events, event submissions, fests, and admin tables.
Project `tcthrfpkydcmenxwajfg` contains a separate student workspace schema. Do not switch Hapn to that project without an explicit decision.

## Safe preview
Open `anonymous-chat-preview.html` from this branch to inspect the visual prototype. For local interaction, download the file and open it in a browser. This is not a hosted preview URL and does not connect to a live chat backend.

## Remaining verification before launch
1. In Supabase Dashboard > Authentication > Sign In / Providers, confirm **Anonymous Sign-Ins** is enabled. This setting has not been verified through the available project tools.
2. Open `anonymous-chat-connected-preview.html` from a local web server or hosted branch preview (not via `file://`, since ES modules may be blocked). Test anonymous auth, loading/sending messages, switching rooms, and two-browser Realtime Presence counts.
3. Add a trusted moderation workflow for reviewing reports and deleting messages; do not expose moderation privileges to chat users.
4. Reporting UI now uses the database's allowed reason values. Admin-only RLS policies have been added so existing Hapn admins can review/update reports and moderate message rows; test these using an admin session before launch.
5. Complete block/mute controls, user-facing community rules, accessible error/loading states, and abuse protection before launch.
6. Verify security, accessibility, mobile layout, server-side spam controls, and actual concurrent online counts.
7. Only after explicit approval, plan a separate reviewed merge/deployment.

## Important limitations
- A browser-only counter cannot reliably count all users. Use Supabase Realtime Presence and account for disconnects/heartbeats.
- Client-side cooldowns alone are not anti-spam protection; enforce limits server-side.
- RLS is required for every chat table. Do not expose service-role credentials in frontend code.
- No production schema, settings, or deployment has been changed by this draft.
