# Jaxtri Platform — Auth + Invites Foundation

This build starts the real Cloudflare backend foundation for Jaxtri.

## Included

- Public **Jaxtri Labs Affiliate Program**
- Single shared login for owner, manager, and affiliate
- Bootstrap owner setup page at `/setup.html`
- Application form saved to D1
- Owner/manager application review queue
- Invite-based account creation
- Optional email invites using Resend
- Affiliate content submission
- Owner/manager content review queue
- D1 database schema
- Cloudflare Pages Functions API scaffold

## First setup

1. Keep your current `wrangler.toml` if it already has your real D1 database ID.
2. If needed, copy `wrangler.toml.example` to `wrangler.toml` and paste your real D1 database ID.
3. Run the SQL in `database/schema.sql` against your D1 database in Cloudflare.
4. Push to GitHub.
5. Visit `/setup.html` once to create the first owner account.

## Email invites

Email sending is optional. If you do not configure email, the invite API returns a link you can copy manually.

To enable email invites, add Cloudflare environment variables/secrets:

- `RESEND_API_KEY`
- `INVITE_FROM_EMAIL`
- `INVITE_BASE_URL`

## Roles

- `owner`: full control, including Admin section.
- `manager`: daily operations, approvals, content review.
- `affiliate`: Academy access and content submissions.

## Notes

This is a foundation. It is meant to be pushed and tested on Cloudflare Pages with D1 bound as `DB`.
