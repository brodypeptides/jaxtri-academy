# Jaxtri Sprint 2 — Recruitment

Adds the first real onboarding workflow:

- Public affiliate application form
- D1 application submission API
- Owner/manager Recruitment dashboard
- Approve/reject API endpoints
- Dashboard card linked to Recruitment

## Database
If you have not already created the `applications` table, run the SQL in:

`database/sprint2-recruitment.sql`

Run statements one at a time in Cloudflare D1 if needed.

## Push instructions
Copy these files into the repo, commit, push, wait for Cloudflare deploy, then test:

1. `/apply.html` submit a test application
2. login as owner
3. open `/owner-recruitment.html`
4. approve or reject the test application
