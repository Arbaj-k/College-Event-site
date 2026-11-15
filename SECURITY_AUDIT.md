# Hapn secret-safety audit — 2026-11-15

## Scope
Reviewed the public repository source tree, deployment workflow, Supabase Edge Functions, SQL schema and policies, GitHub code-search results for common secret patterns, and the commit history of the Supabase browser config and administrator bootstrap SQL.

## Findings

| Finding | Location | Assessment / action |
|---|---|---|
| Supabase project URL | `js/config.js` | Public endpoint, not a secret. Moved to build-time `SUPABASE_URL` variable. |
| Supabase `sb_publishable_` key | `js/config.js` and historical commit | Public client key by design, not a service-role credential. Moved to build-time `SUPABASE_ANON_KEY` variable. It remains visible in browser runtime; RLS is the security boundary. |
| Service-role key | Supabase Edge Functions | No literal found in the reviewed source. Functions read `SUPABASE_SERVICE_ROLE_KEY` from `Deno.env`; keep it configured only as a Supabase Edge Function secret. |
| OneSignal REST API key | `supabase/functions/send-event-push/index.ts` | No literal found. Read from `Deno.env.get("ONESIGNAL_REST_API_KEY")`. Removed response-body logging on OneSignal failure so response payloads cannot accidentally echo sensitive values. |
| Database passwords / connection strings | Repository search | No PostgreSQL password URI or MongoDB connection URI found in the searches performed. |
| OAuth client secrets / third-party private API keys | Repository search | No private OAuth secret, Stripe secret, OpenAI key, Firebase private key, AWS secret or Twilio token identified in the searches performed. Google OAuth client IDs, Google Analytics measurement ID and OneSignal App ID are public identifiers, not client secrets. |
| Admin UID and email | `supabase/add-admin.sql` | Personal identifiers, not passwords or tokens. Replaced with placeholders; old values remain in Git history. |
| Password handling | Login/reset forms | Values are read from user input and passed to Supabase Auth; no hardcoded password literal found in reviewed code-search results. |

## Changes made in this branch

1. `.env` and `.env.*` are ignored; `.env.example` is the only allowed example file.
2. Removed the tracked `js/config.js` containing the public Supabase configuration. The Pages build now generates it from GitHub Actions repository variables.
3. `build-config.js` validates the project URL and rejects Supabase secret keys and service-role JWTs before writing browser config.
4. `generate-sitemap.js` reads only the build environment; it no longer parses committed frontend config as a fallback.
5. GitHub Pages workflow injects `SUPABASE_URL` and `SUPABASE_ANON_KEY` from repository variables.
6. `supabase/add-admin.sql` no longer contains a real UID/email.
7. OneSignal error logging no longer prints the upstream response body.
8. Added least-privilege grants for public SECURITY DEFINER helpers: anonymous RPC access is revoked; app-required authenticated calls remain; trigger-only functions cannot be called directly.
9. Added a README warning that any historical private credential must be rotated and that removing a value from the latest commit does not purge Git history.

## Database RLS verification

Queried `pg_tables` for all `public` tables: **no public table was found with RLS disabled**.

This confirms RLS is enabled, not that every policy is semantically perfect. The policy inventory includes public read policies for intentionally public resources (published events/fests, chat rooms, active college-domain lookup and public Campus Board posts where permitted), and authenticated-only policies for member-owned/private resources. Keep reviewing policy semantics whenever schema changes.

Supabase Security Advisor also reported:
- SECURITY DEFINER functions callable by anon/authenticated roles. The migration in this branch narrows grants for helper functions and revokes direct execution on trigger-only cleanup functions. Chat matching RPCs remain available to authenticated anonymous-auth sessions and enforce the anonymous-session claim internally.
- Leaked-password protection is disabled. This is an Auth dashboard setting and was not changed automatically.

## Required owner actions before deployment

1. In GitHub repository Settings → Secrets and variables → Actions → **Variables**, create:
   - `SUPABASE_URL` = the public project URL
   - `SUPABASE_ANON_KEY` = the public anon/publishable key
2. Apply migration `20261115000400_security_function_grants.sql` in Supabase SQL Editor, then re-run the Security Advisor.
3. In Supabase Auth settings, enable leaked-password protection if supported by the project's current plan/settings.
4. Keep `SUPABASE_SERVICE_ROLE_KEY` and `ONESIGNAL_REST_API_KEY` only in Supabase Edge Function secrets; do not add them to GitHub Actions variables or frontend configuration.
5. If a private credential was ever committed in any historical commit or other repository, rotate it at its provider and then consider history rewriting. The audit found only the public publishable key in the historical `js/config.js` commit; that key is not a private credential.

## Limitations
This is a repository and configuration audit, not a formal penetration test. GitHub's code search and the inspected Git history paths do not prove that every possible secret in every historical blob, fork, artifact, issue, or external deployment log has been eliminated. No secret values are reproduced in this report.
