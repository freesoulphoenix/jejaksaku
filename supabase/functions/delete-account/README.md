# Delete account

Deletes the signed-in user's account and app data.

What it removes:

- Supabase Auth user
- `user_profiles` row
- All app rows that cascade from `user_profiles`
- Receipt files in `receipts/{user_profile_id}`
- Statement files in `statements/{user_profile_id}`

Deploy:

```bash
supabase functions deploy delete-account
```

Set the service role key if it is not already set for functions:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The frontend calls this function with the signed-in user's Supabase session. Do not expose the service role key in the frontend.
