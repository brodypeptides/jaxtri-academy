# Jaxtri Patch — Website Commission Control

Adds website-based commission editing to `owner-users.html`.

## What changes

- Owners can set commission percentages directly in Users + Codes.
- Owner profiles can now have commission updated in the web panel.
- Owner role/status/title are still protected and stay D1-only.
- Managers can still help with affiliate codes, but cannot change commission rates.
- Affiliates still cannot change their own code or commission rate.

## Files

- `owner-users.html`
- `functions/api/admin/users.js`
- `functions/api/admin/users/[id].js`
- `functions/api/admin/affiliate-codes.js`
- `assets/navigation-categories.css`

## Database

No new D1 migration is required if Sprint 5.1 already ran.

If the commission box says `Run migration first`, run:

```sql
ALTER TABLE users ADD COLUMN commission_percentage REAL;
```

## Test

1. Push/deploy this patch.
2. Open `owner-users.html`.
3. Search your profile.
4. Set commission to `30`.
5. Click `Set commission`.
6. Confirm the profile card shows `30%`.

Suggested commit message:

```text
website commission controls
```
