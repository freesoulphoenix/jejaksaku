# Dompet Daily Supabase Setup

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
