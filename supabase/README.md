# Jejak Saku Supabase Setup

## Apply the Database Schema

1. Open your Supabase project dashboard.
2. Go to **SQL Editor**.
3. Open `supabase/schema.sql` from this project.
4. Copy the full SQL file.
5. Paste it into the Supabase SQL Editor.
6. Click **Run**.

The schema creates the current backend tables: `accounts`, `categories`, `project_tags`, `transactions`, and `upcoming_due`. It uses UUID primary keys, prepares nullable `user_id` columns for future Supabase Auth ownership, and seeds global default categories and project tags.

## Get Supabase URL and Publishable Key

1. Open your Supabase project dashboard.
2. Go to **Project Settings**.
3. Open **API**.
4. Copy the **Project URL**.
5. Copy the **publishable** key.

## Create the Client Environment File

Create or edit `client/.env`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Restart the Vite dev server after changing environment variables.

## Server Environment

Create or edit `server/.env`:

```env
PORT=5000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

Use the service role key only on the backend. Never expose it in the React client.

## Purchase reconciliation

Apply `033_purchase_reconciliation.sql` after the earlier numbered migrations and before deploying the matching frontend. It adds user-scoped review history and atomic functions for linking purchases, saving Keep Both decisions, and Undo. Existing transactions are unchanged until the user confirms a link.

With the Supabase CLI already authenticated and linked:

```bash
supabase db query --linked --file supabase/033_purchase_reconciliation.sql
supabase db query --linked --file supabase/034_merge_purchase_notes.sql
supabase db query --linked --file supabase/tests/purchase_reconciliation.sql
```

The regression script uses temporary fixture users and records inside a transaction and rolls everything back. It checks balance changes, both source orders, incoming-source reconciliation, conflicting fields, duplicate source protection, and row-level security. Frontend matching and parsing tests run with `npm test` and in the Pages deployment workflow.

Activity has a **Check for entry duplication** button beneath its filters and totals. Linking requires explicit choices for conflicting descriptions, categories, project tags, and activity values. Notes are combined automatically, separated by a blank line; identical notes appear once, and empty notes are omitted. Apply migration `034_merge_purchase_notes.sql` to enable this behavior on the server. Original source details remain in review history; linked transactions count once in Activity and reports. Undo is available under **Linked purchases · Undo** in the review dialog, and refuses to overwrite later edits.
