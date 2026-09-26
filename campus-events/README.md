# Campus Events

A simple college events website. Students browse events and register through **Google Forms**. Admins sign in to add, edit and delete events.

- **Frontend:** plain HTML, CSS and JavaScript (no build tools)
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Row Level Security)
- **Hosting:** Netlify

There are no student accounts, payments, comments or custom registration. Registration is always a Google Form that opens in a new tab.

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
│   ├── config.js         ← your Supabase URL + anon key go here
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
└── build-config.js       Writes js/config.js from Netlify environment variables
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

### 8. Where to put the Supabase configuration
1. In Supabase open **Project Settings → API** (or **API Keys**).
2. Copy the **Project URL** and the **anon / publishable key**.
3. Paste them into `js/config.js`:

```js
window.CE_CONFIG = {
  SUPABASE_URL: "https://abcdxyz.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi..."
};
```

> The anon / publishable key is designed to be public. Security comes from RLS.
> **Never** put the `service_role` / secret key anywhere in this project. `build-config.js` refuses it if you try.

On Netlify you can skip editing this file and use environment variables instead (step 10).

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

### 10. Deploy to Netlify

**Option A: from GitHub (recommended, uses environment variables)**
1. Push the `campus-events` folder to a GitHub repository.
2. In Netlify: **Add new site → Import an existing project**, choose the repository.
3. Leave the settings as they are. `netlify.toml` sets the build command (`node build-config.js`) and publish directory (`.`).
4. Before deploying, open **Site configuration → Environment variables** and add:
   - `SUPABASE_URL` = your Project URL
   - `SUPABASE_ANON_KEY` = your anon / publishable key
5. Click **Deploy**. Every `git push` redeploys the site.

**Option B: drag and drop (quickest)**
1. Put your values in `js/config.js` (step 8).
2. Go to <https://app.netlify.com/drop> and drag the whole `campus-events` folder in.

**After deploying:** in Supabase open **Authentication → URL Configuration** and set **Site URL** to your Netlify address (for example `https://your-site.netlify.app`).

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

- The Supabase JS library is loaded from the jsDelivr CDN (`@supabase/supabase-js@2`). For stricter control, pin an exact version in each HTML file.
- Dates are compared using the visitor's local date. An event counts as "past" the day after its date. A registration deadline is inclusive (open through the end of that day).
- To add a category, update it in three places: the `check` constraint in `supabase/schema.sql`, `CE.CATEGORIES` in `js/common.js` and the `<select>` in `admin/add-event.html`.
