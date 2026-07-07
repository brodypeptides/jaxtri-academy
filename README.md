# Jaxtri Platform — Sprint 1 Auth

This build adds the first real backend feature for Cloudflare Pages + D1:

- `/setup.html` creates the first owner account
- passwords are hashed with PBKDF2 before storage
- a secure session cookie is created
- `/login.html` uses one shared login for owner/manager/affiliate
- role-based redirects start working
- `/api/me` checks the current session

## Important Cloudflare setup

1. Keep your existing `wrangler.toml` with the D1 binding:

```toml
[[d1_databases]]
binding = "DB"
database_name = "jaxtri_academy"
database_id = "YOUR_DATABASE_ID"
```

2. Run the SQL inside `database/schema.sql` in your D1 console.

Do **not** type `database/schema.sql` into the SQL console. Open the file, copy its contents, paste the actual SQL, then run it.

3. Push to GitHub. Cloudflare Pages will deploy.

4. Visit `/setup.html` and create your first owner account.
