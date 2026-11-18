# Hapn Pre-Deploy Production Audit

**Date:** 2026-11-15  
**Architecture:** Static HTML/CSS/JS on GitHub Pages, Cloudflare in front of custom domain, Supabase Auth/Postgres/Storage/Edge Functions. No Express/Node server or package.json is present.

| # | Check | Status | Finding / action |
|---|---|---|---|
| 1 | Environment variables | PASS (with deployment verification) | GitHub Pages build requires `SUPABASE_URL` and `SUPABASE_ANON_KEY`; `build-config.js` exits non-zero if missing/invalid and rejects secret/service-role keys in browser config. Edge Functions use `Deno.env` for server secrets. Confirm GitHub Actions Variables and Supabase Function Secrets are populated. |
| 2 | Debug code / test endpoints | PASS (repository scan) | Code search found no TODO/FIXME or obvious /debug, /admin-backdoor, /seed-data runtime endpoint matches. The only `console.log` hit was the multi-college smoke test; build-config output is build-time only. Test scripts stay in tests/ and are not Pages routes. |
| 3 | Error handling | FIXED in reviewed Edge Functions | `super-admin-api` and `send-event-push` now return generic internal failures with request IDs; detailed provider/database errors are reduced to internal error codes in server logs. Event submit and admin auth UI do not expose raw provider messages. |
| 4 | Security headers | PARTIAL — Worker code supplied | Cloudflare Worker source sets nosniff, DENY, 1-year HSTS, CSP, Referrer-Policy and Permissions-Policy. It is not active until deployed and routed to hapn.info/* and www.hapn.info/*. GitHub Pages does not apply Netlify-style _headers files. CSP still permits inline scripts and required CDNs because the existing app uses inline scripts; test all flows before tightening/removing unsafe-inline. |
| 5 | Auth rate limiting | NOT VERIFIED — owner action | Admin login/password reset call Supabase Auth directly. Client throttling is not a security boundary. Set Supabase Auth rate limits in Authentication → Rate Limits: login max 5/min/IP and password recovery max 3/hour (or stricter supported values). Connected tools do not expose these settings, so no rate limit is claimed active. |
| 6 | CORS | FIXED in reviewed Edge Functions | Exact allowlist is https://hapn.info and https://www.hapn.info. Unknown origins get no allow-origin header and preflight is rejected. No wildcard is used. |
| 7 | Database TLS / open port | PASS for browser architecture; provider setting needs verification | Browser uses HTTPS Supabase APIs; no direct database URL/password/port is shipped to the frontend. Supabase manages DB TLS. Verify SSL enforcement and network restrictions in Supabase dashboard; source review cannot inspect provider network settings. |

## Changed files

- `js/supabase.js`: accurate missing deployment config guidance.
- `supabase/functions/super-admin-api/index.ts`: CORS allowlist, response security headers, request IDs, generic errors, safe server-side error codes, bounded inputs.
- `supabase/functions/send-event-push/index.ts`: CORS allowlist, response security headers, request IDs, generic errors, no upstream response-body logging, outbound timeout.
- `cloudflare/production-headers-worker.js`: Worker to attach response security headers at Cloudflare edge.
- `PRODUCTION_AUDIT.md`: full checklist.

## Required before production sign-off

1. Deploy Cloudflare Worker and attach routes for both custom-domain hostnames; then verify actual response headers.
2. Configure and verify Supabase Auth login/recovery rate limits in the dashboard.
3. Verify GitHub Actions variables `SUPABASE_URL` and `SUPABASE_ANON_KEY`, and Supabase Edge Function secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ONESIGNAL_REST_API_KEY`, and `GEMINI_API_KEY` where applicable.
4. Verify Supabase database SSL enforcement/network restrictions.
5. Run live login, reset, invite, push, anonymous chat and Campus Board smoke tests after deployment.

## Limitations

This is a repository/configuration audit, not a penetration test. Source searches may miss historical/obfuscated code. The live Cloudflare response headers and Auth rate-limit values were not readable through connected project tools. Worker and rate-limit controls are not active until owner deployment/configuration.


## Archive feature removal

The public Event Archive page, homepage/events navigation links, Super Admin archive view/shortcut/manual action, Edge Function archive action, and daily archive cron/function have been removed. Existing `event_archive` rows are retained as private legacy records; this change does not delete historical data.

## Follow-up verification — 2026-11-19

### Repository state
- The Cloudflare Worker smoke test and production-hardening smoke test are wired into the Pages build workflow.
- The Worker source and Wrangler route configuration are present on `main`. The custom-domain route is still not active until the Cloudflare zone is available to the deploying account and the Worker is attached successfully.
- Event and Campus Board sharing now pass URL-only payloads: neither handler downloads an image or adds a `File` attachment. Native share and clipboard fallback remain available.
- PR #80 is stale relative to `main`: its Edge Function hardening, browser error redaction, and Worker work are represented by newer main-branch content. Do not merge it blindly; reconcile/close it after confirming its remaining documentation changes are covered.

### Supabase production checks
- The live project is reachable and healthy. The `privacy_hardening_campus_board` migration is present in the live migration history (version `20261115082820`).
- Security Advisor currently reports:
  - `campus_push_deliveries` has RLS enabled with no policies. This is expected only if access is intentionally service-role-only; keep it that way unless a client-side access use case is explicitly approved.
  - `get_sharencare_home_preview(uuid)` is executable by `anon` and `authenticated`. Its current return payload is limited to public/college-visible post preview fields (post ID, initials, body, type and creation time); anonymous execution is part of the public homepage preview. Re-review this function whenever its return fields or visibility rules change.
  - Other flagged SECURITY DEFINER RPCs are granted to authenticated users and include caller/ownership or role checks in their bodies. Do not remove these grants indiscriminately; doing so can break chat, Campus Board and admin workflows.
  - Anonymous-role policy warnings are expected in part because the product intentionally enables anonymous chat. The Campus Board policies use `is_real_campus_user()`; preserve the distinction between anonymous chat and verified Campus Board access.
  - Leaked-password protection is still reported disabled. Enable it in Supabase Authentication settings if the current project plan exposes the control.
- Performance Advisor currently reports 21 foreign keys without covering indexes and 13 RLS policies that may re-evaluate auth functions per row. It also reports multiple permissive policies and several unused indexes. These are performance recommendations, not proof of a security bypass. Index additions and policy rewrites should be planned against actual query patterns and regression-tested before applying.
- Auth rate limits, GitHub repository variables, Edge Function secrets, database SSL/network restrictions and post-deploy user flows still require dashboard/live verification. No provider setting is claimed changed by this repository work.

### Verification limits
- GitHub connector currently returned no workflow runs or commit status entries for the latest share commits. This is not evidence that CI passed.
- This review is a source/configuration and live-advisor check, not a penetration test or complete browser end-to-end run.
