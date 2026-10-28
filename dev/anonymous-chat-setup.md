# Hapn Anonymous Chat — Development Setup

## Safety / deployment status
- Feature files are isolated on branch `anonymous-chat-dev`; `main` and the live website have not been merged or updated.
- Do not merge or deploy until the user has reviewed the preview and explicitly approved.
- `anonymous-chat-preview.html` is a UI-only prototype. `anonymous-chat-connected-preview.html` connects to Hapn's Supabase backend and has not yet passed browser end-to-end testing.
- The original public chat tables, RLS policies, rate-limit trigger, and Realtime publication were already applied to Hapn's existing Supabase project `xeablvxtlxdwuiiawsgq`.
- The random private-chat migration was applied to the same project: `chat_match_queue`, `chat_private_conversations`, `chat_private_messages`, and their RLS policies/RPCs. `chat_private_messages` is in the `supabase_realtime` publication. A follow-up migration added `chat_private_reports` with participant-only report insertion and admin-only report updates.
- Matching queue polling was hardened in the live `chat_match_start(text)` function so a waiting user keeps their queue position rather than being deleted/reinserted every poll. Function privileges were rechecked: `anon` cannot execute the RPC; `authenticated` can, with anonymous-session validation inside the function.
- The admin dashboard is `anonymous-chat-moderation.html`. The admin-only `SELECT` policy `chat_admin_read_messages` was applied to Supabase and verified in `pg_policies`. Report reasons/statuses and message/nickname limits were checked against live database constraints. Browser-level admin moderation is still untested.
- The connected preview now rejects an existing non-anonymous session in its isolated auth store and requests a fresh anonymous session. This guard is code-reviewed but not browser-tested.
- Never put Supabase service-role/secret keys, passwords, or private user data in this public repository. The frontend should only use the publishable key from the existing Hapn config.

## Correct Supabase project
The repository's existing Hapn configuration points to `xeablvxtlxdwuiiawsgq`, which contains Hapn's event, submission, fest, and admin data. Do not switch to the unrelated project `tcthrfpkydcmenxwajfg`.

## Preview
Branch source: https://github.com/Arbaj-k/College-Event-site/tree/anonymous-chat-dev

- UI prototype: `dev/anonymous-chat-preview.html`
- Connected test page: `dev/anonymous-chat-connected-preview.html`
- Random private-chat test page: `dev/anonymous-chat-random-match-preview.html`
- Integrated connected room-selector test page: `dev/anonymous-chat-connected-preview.html`
- Admin moderation preview (includes private reports): `dev/anonymous-chat-moderation.html`
- Random private-chat migration draft: `dev/anonymous-chat-random-match-migration.sql`
- Admin moderation page: `dev/anonymous-chat-moderation.html`
- Admin read policy SQL: `dev/anonymous-chat-admin-read-policy.sql`

The files are in the development branch, not the live site. A local web server or GitHub branch preview is needed for ES modules; opening the connected page via `file://` may block imports.

## Required pre-launch verification
1. In Supabase Dashboard → Authentication → Sign In / Providers, confirm **Anonymous Sign-Ins** is enabled. This has not been verified through available project tools.
2. The `chat_admin_read_messages` policy is applied and verified. Confirm `public.is_admin()` returns true only for authorized Hapn admins; the existing dashboard also calls this function before displaying moderation tools.
3. Test in a browser with two separate browser profiles: anonymous auth, automatic nickname persistence, room switching, sending/receiving messages, and Realtime online counts.
4. Test public-room reporting and private-chat reporting separately. The private-chat report table is `chat_private_reports`; confirm reports can only be inserted by a participant in the relevant conversation and only admins can update report status. Test admin moderation with an actual Hapn admin account. Confirm non-admins cannot read reports, list all messages for moderation, or hide messages. Report reasons in the UI match the database constraint: `spam`, `harassment`, `hate`, `personal_information`, `other`.
5. Verify message reason constraints match the database, plus empty/loading/error states, keyboard/accessibility, mobile layout, and spam controls.
6. Test reconnect/disconnect and check that presence counts recover correctly. A displayed online count is approximate and should not be presented as an exact census.
7. Only after the user reviews and explicitly approves, prepare a separate reviewed merge/deployment.

## Current limitations
- Actual browser end-to-end tests have not been run in this environment. Do not claim the chat is fully working until tested.
- The connected test page now routes Campus Lounge to `chat_match_start`, `chat_match_leave`, `chat_private_messages`, and `chat_private_reports`; Group Chat and Ask the Community continue using the public `chat_messages` table. Queue cleanup on room-switch was added. This frontend integration is committed on `anonymous-chat-dev`, but has not passed browser end-to-end testing.
- Admin moderation preview now includes a separate private Campus Lounge reports panel. It loads private report/message data, lets an admin update report status, and soft-hide reported private messages. This is code-only and still needs testing with a real authorized admin account.
- Supabase anonymous sign-in availability is unconfirmed.
- The admin message SELECT policy is applied, but moderation message listing/hiding has not been tested in a browser.
- Complete block/mute controls, visible community rules, and a moderation escalation process still need review before public launch.
