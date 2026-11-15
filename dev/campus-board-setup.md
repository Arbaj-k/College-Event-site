# Hapn Campus Board setup

## What this change adds

- A Campus Board card on the Hapn homepage linking to `/connect/`.
- A college-email magic-link login. The email must match a domain approved by Hapn Super Admin.
- A Super Admin-only domain allowlist, managed from the existing **Colleges → Add/Edit College** dialog. Enter one domain per line, without `@`.
- Verified student membership is assigned to the college that owns the exact email domain.
- A live college-scoped post feed at `/connect/board/`. Students see only posts for their assigned college. Row Level Security enforces this in PostgreSQL.
- Existing College Admin accounts can open their own college board and moderate posts; they cannot cross into another college.

## Required Supabase setup

Apply these migrations in order to the Hapn Supabase project:

1. `20261112_multi_college_platform.sql` (the existing multi-college foundation)
2. `20261115000000_campus_board_email_domains.sql`
3. `20261115000100_campus_board_posts.sql`

In **Supabase Dashboard → Authentication → URL Configuration**:

- Set the Site URL to `https://hapn.info`.
- Add `https://hapn.info/connect/` to the Redirect URLs allowlist.
- Add the matching local development URL if testing locally.

In **Authentication → Providers → Email**, keep Email enabled. The Campus Board uses Supabase email magic links, not numeric OTP codes. Keep the standard confirmation URL in the email template.

## Enable a college

1. Sign in to the Hapn Super Admin portal.
2. Open **Colleges**, then add or edit a college.
3. In **Approved student email domains**, enter official domains, one per line (for example `students.example.edu.in`).
4. Save. The domain is globally unique and cannot be assigned to two colleges.
5. Only then can people with addresses at that domain request a Campus Board link.

Do not approve public providers such as Gmail, Yahoo, or Outlook as college domains. Use domains confirmed by the institution.

## Verification notes

- New Auth signups with unapproved domains are rejected by the database trigger as well as the login page.
- The `ensure_campus_member()` RPC checks the authenticated, email-confirmed Supabase user; it does not trust a college ID sent by the browser.
- Board reads and writes are isolated by `campus_posts` RLS policies.
- This static frontend does not contain a service-role key.

## Deployment

The repository branch needs to be merged and deployed to hapn.info after the migrations and Auth redirect URL are configured. A GitHub Pages/Cloudflare deployment does not apply Supabase migrations automatically.
