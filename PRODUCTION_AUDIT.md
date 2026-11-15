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
