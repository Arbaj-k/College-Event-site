# Hapn

> **Security notice:** Any real password, private API token, service-role key, database credential, or OAuth client secret ever committed to Git must be rotated immediately. The historical Supabase anon/publishable key in this repository is designed to be public and is not a secret; it must still be protected by RLS. Git history is immutable through normal file edits, so removing a value from the current tree does not erase past commits.

A simple college events website. Students browse events and register through **Google Forms**. Admins sign in to add, edit and delete events.

- **Frontend:** plain HTML, CSS and JavaScript (no build tools)
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Row Level Security)
- **Hosting:** GitHub Pages (GitHub Actions build)

There are no student accounts, payments, comments or custom registration. Registration is always a Google Form that opens in a new tab.


## Secret-safety audit (2026-11-15)

- Browser configuration is generated during build from `SUPABASE_URL` and `SUPABASE_ANON_KEY`; the generated `js/config.js` is git-ignored and is no longer tracked.
- GitHub Pages requires repository Actions **Variables** named `SUPABASE_URL` and `SUPABASE_ANON_KEY` (Settings → Secrets and variables → Actions → Variables). These are public-safe values; the publishable key is visible to browsers by design.
- Local development: copy `.env.example` to `.env`, fill in the same two public values, then run `node build-config.js`.
- Never add `SUPABASE_SERVICE_ROLE_KEY`, `ONESIGNAL_REST_API_KEY`, database passwords, OAuth client secrets or other private credentials to browser config, GitHub variables, or committed files. Put server-only credentials in Supabase Edge Function secrets.
- A historical Supabase `sb_publishable_` key was found in `js/config.js`. This key is designed for public client use and is not a private secret. No service-role key, database password, private OAuth client secret, or OneSignal REST key was identified by the repository and Git-history scans performed for this audit.
- An administrator Auth UID and email were present in `supabase/add-admin.sql`; they were replaced with placeholders. These are identifiers, not authentication credentials. Git history still retains the old values; normal commits do not erase history.
- **Rotation warning:** if any real password, service-role key, database credential, OAuth client secret, or private third-party API token was ever committed, rotate/revoke it immediately. Remove it from Git history separately if needed; deleting it from the latest source is not enough.
- See `SECURITY_AUDIT.md` for the findings, RLS check, remaining manual actions and scope.


---

## Project structure

```
campus-events/
├── index.html            Home: hero, "Next up" ticket, search, filters, event cards
├── events.html           All events (same search and filters)
├── event.html            Event details page (event.html?id=...)
├── about.html
├── 404.html
├── admin/
│   ├── login.html        Admin login
│   ├── dashboard.html    Stats, event list, edit / delete
│   └── add-event.html    Add AND edit form (add-event.html?id=... edits)
├── css/
│   ├── style.css         Public site + shared styles
│   └── admin.css         Admin-only styles
├── js/
│   ├── config.js         ← generated at build time; no committed credentials
│   ├── supabase.js       Creates the Supabase client
│   ├── common.js         Shared helpers (dates, escaping, toasts, menu)
│   ├── events.js         Public event list, search, filters, details page
│   ├── auth.js           Login + admin check ("am I in the admins table?")
│   └── admin.js          Dashboard, add / edit / delete, poster upload
├── assets/images/        Logo, placeholder and 5 sample posters (SVG)
├── supabase/
│   ├── schema.sql        Tables + RLS policies + storage bucket (run first)
│   ├── sample-data.sql   5 sample events (run once)
│   └── add-admin.sql     Makes a user an admin
├── netlify.toml          Deploy settings + security headers
├── build-config.js       Writes js/config.js from environment variables\n└── .env.example          Safe local-development variable template
```

---

## Setup, step by step

### 1. Create the Supabase project
1. Go to <https://supabase.com>, sign in and click **New project**.
2. Choose a name (for example `campus-events`), set a strong **database password** (save it somewhere safe) and pick the region closest to your college.
3. Wait a minute or two until the project is ready.

### 2. Create the database tables
1. In your project, open **SQL Editor → New query**.
2. Open `supabase/schema.sql` from this folder, copy everything, paste it and click **Run**.

This one file creates the `events` and `admins` tables, the admin-check function, all Row Level Security policies (steps 6 and 7 below) and the poster storage bucket. It is safe to run again.

3. Open **SQL Editor → New query** again, paste `supabase/sample-data.sql` and click **Run** to add 5 sample events (run this only once).

Tables created:

| Table | Columns |
|---|---|
| `events` | id, title, poster_url, date, time, venue, organizer, category, short_description, description, registration_deadline, registration_link, is_published, created_at, updated_at |
| `admins` | id, user_id, email, role, created_at |

`is_published` is one extra column: an event with `is_published = false` is a hidden draft that only admins can see. The admin form has a "Show this event on the public website" checkbox for it.

### 3. Enable authentication
1. Go to **Authentication → Sign In / Providers** (older dashboards: **Authentication → Providers**).
2. **Email** is enabled by default. Keep it on.
3. Recommended: turn **off** "Allow new users to sign up". Students never need accounts, and you will create admin users yourself in step 4. (Even if sign-ups stayed on, new users would still not be admins. The database decides that.)

### 4. Create the first admin account
1. Go to **Authentication → Users → Add user → Create new user**.
2. Enter the admin's email and a strong password (12+ characters).
3. Tick **Auto Confirm User** and click **Create user**.

### 5. Add that user to the `admins` table
1. In **Authentication → Users**, find the user and copy the **User UID** (a long value like `3f2b7c1e-...`).
2. Open **SQL Editor → New query** and run (use your own values):

```sql
insert into public.admins (user_id, email, role)
values ('PASTE-THE-USER-UID-HERE', 'admin@example.com', 'admin');
```

Only this account can now use the admin dashboard.

**Adding another admin later:** create another user (step 4), copy their UID and run the same `insert`.
**Removing an admin:** `delete from public.admins where email = 'admin@example.com';`

`supabase/add-admin.sql` also contains a version that looks the UID up from the email for you.

### 6. Storage (event posters)
`schema.sql` already created a bucket called **event-posters**. To check it, open **Storage** in the dashboard. You should see:

- the bucket `event-posters`, marked **Public** (so posters can be shown on the website)
- a 5 MB size limit and only JPG, PNG and WebP images allowed
- policies so that **only admins** can upload, replace or delete posters

If you ever have to create it by hand: **Storage → New bucket → name `event-posters` → Public bucket on**, then re-run `schema.sql` to attach the policies.

### 7. Row Level Security (RLS)
`schema.sql` already turned RLS on and created these policies. You can review them in **Authentication → Policies**.

| Table | Who | Allowed |
|---|---|---|
| `events` | Everyone (no login) | **Read** published events only |
| `events` | Admins | Read all (including drafts), **insert, update, delete** |
| `events` | Anyone else signed in | Read published events only. No writes. |
| `admins` | A signed-in user | Read **only their own row**. Nobody can write through the API. |
| `storage.objects` (`event-posters`) | Everyone | View posters |
| `storage.objects` (`event-posters`) | Admins | Upload, update, delete |

"Admin" means: the user's ID exists in `public.admins` with `role = 'admin'`. This is checked by the database function `public.is_admin()`. The frontend check only decides what to show; it cannot be used to get around the database.

### 8. Supabase configuration (environment variables only)
1. In Supabase open **Project Settings → API**.
2. Copy the **Project URL** and the **anon / publishable key** (never the service-role/secret key).
3. For local development, copy `.env.example` to `.env`, fill in those two public values, then run `node build-config.js`. The generated `js/config.js` is git-ignored from commits by policy; do not commit it.
4. For GitHub Pages, add repository **Variables** named `SUPABASE_URL` and `SUPABASE_ANON_KEY` under **Settings → Secrets and variables → Actions → Variables**. The Pages workflow generates the browser config during deployment.

The anon/publishable key is intentionally visible in browser network traffic. It is not a secret; database security depends on RLS. The service-role key, database password, OneSignal REST API key and all OAuth client secrets must remain server-side (Supabase Edge Function secrets).

### 9. Run the project locally
Browsers block some features when a page is opened by double-clicking it, so serve the folder with any small web server. From inside the `campus-events` folder, use one of these:

```bash
# Option 1: Python (already installed on most computers)
python3 -m http.server 8000

# Option 2: Node.js
npx serve .

# Option 3: VS Code, install "Live Server" and click "Go Live"
```

Open <http://localhost:8000>. The admin login is at <http://localhost:8000/admin/login.html>.

### 10. Deploy to GitHub Pages

The repository deploys through `.github/workflows/pages.yml`. Set the two GitHub Actions repository variables described in step 8, then push to `main` or run the workflow manually.
After deploying, keep the Supabase Auth Site URL and allowed redirect URLs set to `https://hapn.info` and the exact Hapn callback routes used by sign-in.

### 11. Add, edit and delete events
Sign in at `/admin/login.html` with the admin account.

- **Add:** click **+ Add New Event**, fill in the form, optionally choose a poster, and click **Publish Event**. You will see "Event published successfully!" and the event appears on the public site straight away.
- **Edit:** on the dashboard click **Edit** next to an event, change anything (choose a new poster only if you want to replace it) and click **Save Changes**. You will see "Event updated successfully!".
- **Delete:** click **Delete**, then confirm. The dialog asks "Are you sure you want to delete this event?" with **Cancel** and **Delete** buttons. The poster file is removed from Storage too.

Poster tips: use wide images (about 1600 × 1000, ratio 16:10), JPG, PNG or WebP, under 5 MB. If you don't upload one, a neutral placeholder is shown.

---

## Replacing the sample data

| To change | Do this |
|---|---|
| **Event poster** | Dashboard → **Edit** → choose a new poster → **Save Changes**. (Sample posters live in `assets/images/`.) |
| **Event name** | Dashboard → **Edit** → *Event Name* |
| **Date** | Dashboard → **Edit** → *Date* (and *Time*) |
| **Venue** | Dashboard → **Edit** → *Venue* |
| **Description** | Dashboard → **Edit** → *Short Description* (card) or *Full Description* (details page) |
| **Google Form URL** | Dashboard → **Edit** → *Google Form URL* |

To get a Google Form link: open the form → **Send** → the link tab → tick "Shorten URL" → **Copy** (it looks like `https://forms.gle/abc123`). Make sure the form is set to accept responses.

To remove all sample events at once, run this in the SQL Editor (this also removes any real events): `delete from public.events;`

---

## How the security works

- **Supabase Auth** handles the login. No passwords are stored in the code or in your own tables.
- **Admin idle timeout:** the browser signs out an admin after 15 minutes without interaction. This limits unattended-session exposure; it is defense in depth, not a substitute for server-managed `HttpOnly` cookies.
- **Admin check:** after login, the site looks for the user's ID in the `admins` table. If it is missing, the user sees *"Access Denied — You do not have administrator permission."* and is signed out.
- **The database enforces it:** inserts, updates, deletes and poster uploads are rejected by RLS unless `public.is_admin()` is true. Hiding buttons is only a courtesy.
- The `admins` table has no write policies, so nobody can promote themselves. Only you, in the SQL Editor, can add admins.
- Registration links must be `https://` (enforced in the database and the form). Text from events is HTML-escaped before display. `netlify.toml` adds a Content-Security-Policy and other security headers.
- Uploaded posters get random file names and only JPG, PNG or WebP files up to 5 MB are accepted.

**Quick self-test (optional):** open the public site, then in the browser console (while logged out) run:

```js
await sb.from('events').insert({ title: 'Hacked', date: '2030-01-01', time: '10:00', venue: 'x', organizer: 'x', category: 'Other', short_description: 'x', registration_link: 'https://example.com' })
```

You should get an error like *permission denied* or *row-level security policy*. That is RLS working.

---

## Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| "Supabase is not configured yet" | `js/config.js` still has the placeholder values. See step 8. |
| Events list is empty or shows an error | `schema.sql` / `sample-data.sql` not run, or wrong URL/key. Check the browser console. |
| "Incorrect email or password" | Wrong credentials, or the user was not created with **Auto Confirm User**. |
| "Access Denied" for the real admin | The UID in `admins` does not match the user's UID, or `role` is not exactly `admin`. Check with `select * from public.admins;`. |
| Poster upload fails | The bucket is missing (re-run `schema.sql`), the file is over 5 MB, or the file type is not JPG, PNG or WebP. |
| Netlify build fails with "Set SUPABASE_URL…" | Add both environment variables in Netlify and redeploy (or use Option B). |
| Changes don't show after deploy | Hard refresh the page (Ctrl + Shift + R). |

---

## Notes for developers

- **Session-storage limitation:** the current static frontend stores the Supabase session in `sessionStorage`. JavaScript running on the same origin can still read/use that session, so an XSS flaw could expose it. The 15-minute idle timeout reduces the unattended window but does not prevent token theft while the page is active. Removing JavaScript access requires a larger architecture change: server-managed `HttpOnly; Secure; SameSite` cookies plus server-side endpoints/Netlify Functions for admin database and Storage operations. Do not simply switch to in-memory storage: this multi-page site reloads between admin pages and would lose the session.

- The Supabase JS library is loaded from the jsDelivr CDN (`@supabase/supabase-js@2`). For stricter control, pin an exact version in each HTML file.
- Dates are compared using the visitor's local date. An event counts as "past" the day after its date. A registration deadline is inclusive (open through the end of that day).
- To add a category, update it in three places: the `check` constraint in `supabase/schema.sql`, `CE.CATEGORIES` in `js/common.js` and the `<select>` in `admin/add-event.html`.
