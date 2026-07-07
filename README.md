# Jaxtri Sprint 2 — Recruitment (Fixed)

This fixed package includes the missing shared auth helper at:

```text
functions/lib/auth.js
```

That fixes Cloudflare build errors like:

```text
Could not resolve "../lib/auth.js"
Could not resolve "../../lib/auth.js"
Could not resolve "../../../../lib/auth.js"
```

## What Sprint 2 adds

- Public affiliate application form (`apply.html`)
- Application submitted confirmation page
- Recruitment page for owner/manager review (`owner-recruitment.html`)
- Public application API (`functions/api/applications.js`)
- Owner/manager recruitment API (`functions/api/admin/applications.js`)
- Approve/reject API routes
- Shared auth helper (`functions/lib/auth.js`)
- D1 schema for the applications table (`database/sprint2-recruitment.sql`)

## Important

Do **not** delete your existing files when copying this in. Merge/copy these files into your repo so your Sprint 1 files like login, setup, me, logout, assets, and wrangler.toml stay in place.

After copying:

1. Commit in GitHub Desktop.
2. Push.
3. Wait for Cloudflare deployment.
4. Test `/apply.html`.
5. Test `/owner-recruitment.html` while logged in as owner.
