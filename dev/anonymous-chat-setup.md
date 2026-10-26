# Hapn Anonymous Chat — Development Setup

## Safety status
- This feature is isolated on branch `anonymous-chat-dev`.
- Do not merge this branch into `main` until reviewed and explicitly approved.
- The current HTML is a UI-only preview. Sample messages are not real, and online counters intentionally show no fake numbers.
- The SQL file is a draft only and has NOT been applied to any Supabase project.
- The repository is public, so files committed to this branch are publicly viewable. Do not add secrets, service-role keys, passwords, or private user data.

## Projects checked
The repository's existing Hapn configuration points to Supabase project `xeablvxtlxdwuiiawsgq`, which currently contains the Hapn events, event submissions, fests, and admin tables.
Project `tcthrfpkydcmenxwajfg` contains a separate student workspace schema. Do not switch Hapn to that project without an explicit decision.

## Safe preview
Open `anonymous-chat-preview.html` from this branch to inspect the visual prototype. For local interaction, download the file and open it in a browser. This is not a hosted preview URL and does not connect to a live chat backend.

## Before enabling a real backend
1. Choose an isolated development Supabase environment. Do not run the draft SQL against production.
2. Confirm whether Supabase anonymous sign-in is enabled or implement a suitable sign-in flow. Anonymous identities must be authenticated so RLS can tie each message to `auth.uid()`.
3. Review and test the SQL policies in the isolated environment. Add moderation-only deletion, rate limiting, and report review via trusted server-side logic before launch.
4. Enable Realtime Presence for a dedicated chat channel. Publish only a random session identifier and minimal presence metadata; never send message bodies or personal details through presence.
5. Add UI for consent/rules, nickname selection, posting, reporting, blocking, and error/loading states. Test with multiple browser sessions.
6. Verify security, accessibility, mobile layout, spam controls, and actual concurrent online counts.
7. Only after explicit approval, plan a separate reviewed merge/deployment.

## Important limitations
- A browser-only counter cannot reliably count all users. Use Supabase Realtime Presence and account for disconnects/heartbeats.
- Client-side cooldowns alone are not anti-spam protection; enforce limits server-side.
- RLS is required for every chat table. Do not expose service-role credentials in frontend code.
- No production schema, settings, or deployment has been changed by this draft.
