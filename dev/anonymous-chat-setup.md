# Hapn Anonymous Chat — Development Setup

## Safety / deployment status
- Feature files are isolated on branch `anonymous-chat-dev`; `main` and the live website have not been merged or updated.
- Do not merge or deploy until the user has reviewed the preview and explicitly approved.
- `anonymous-chat-preview.html` is a UI-only prototype. `anonymous-chat-connected-preview.html` connects to Hapn's Supabase backend and has not yet passed browser end-to-end testing.
- The chat tables, RLS policies, rate-limit trigger, and Realtime publication were applied to Hapn's existing Supabase project `xeablvxtlxdwuiiawsgq`. This is a backend change on the existing project even though the website UI is not live.
- The admin dashboard is `anonymous-chat-moderation.html`. The admin-only `SELECT` policy `chat_admin_read_messages` was applied to Supabase and verified in `pg_policies`. Browser-level admin moderation is still untested.
- Never put Supabase service-role/secret keys, passwords, or private user data in this public repository. The frontend should only use the publishable key from the existing Hapn config.

## Correct Supabase project
The repository's existing Hapn configuration points to `xeablvxtlxdwuiiawsgq`, which contains Hapn's event, submission, fest, and admin data. Do not switch to the unrelated project `tcthrfpkydcmenxwajfg`.

## Preview
Branch source: https://github.com/Arbaj-k/College-Event-site/tree/anonymous-chat-dev

- UI prototype: `dev/anonymous-chat-preview.html`
- Connected test page: `dev/anonymous-chat-connected-preview.html`
- Admin moderation page: `dev/anonymous-chat-moderation.html`
- Admin read policy SQL: `dev/anonymous-chat-admin-read-policy.sql`

The files are in the development branch, not the live site. A local web server or GitHub branch preview is needed for ES modules; opening the connected page via `file://` may block imports.

## Required pre-launch verification
1. In Supabase Dashboard → Authentication → Sign In / Providers, confirm **Anonymous Sign-Ins** is enabled. This has not been verified through available project tools.
2. The `chat_admin_read_messages` policy is applied and verified. Confirm `public.is_admin()` returns true only for authorized Hapn admins; the existing dashboard also calls this function before displaying moderation tools.
3. Test in a browser with two separate browser profiles: anonymous auth, automatic nickname persistence, room switching, sending/receiving messages, and Realtime online counts.
4. Test reporting and admin moderation with an actual Hapn admin account. Confirm non-admins cannot read reports, list all messages for moderation, or hide messages.
5. Verify message reason constraints match the database, plus empty/loading/error states, keyboard/accessibility, mobile layout, and spam controls.
6. Test reconnect/disconnect and check that presence counts recover correctly. A displayed online count is approximate and should not be presented as an exact census.
7. Only after the user reviews and explicitly approves, prepare a separate reviewed merge/deployment.

## Current limitations
- Actual browser end-to-end tests have not been run in this environment. Do not claim the chat is fully working until tested.
- Supabase anonymous sign-in availability is unconfirmed.
- The admin message SELECT policy is applied, but moderation message listing/hiding has not been tested in a browser.
- Complete block/mute controls, visible community rules, and a moderation escalation process still need review before public launch.
