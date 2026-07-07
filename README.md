# Jaxtri Platform — Roles + Review Foundation

Public brand: **Jaxtri Labs Affiliate Program**
Private product: **Jaxtri Academy**

This version adds the role model and content review workflow:

- One shared login page
- Roles: owner, manager, affiliate
- Owner/manager operations area
- Affiliate content submission page
- Owner/manager review queue
- Review statuses: draft, pending_review, approved, rejected, archived
- Cloudflare D1 schema draft in `assets/schema.sql`

## Demo Login Buttons
The login page includes demo buttons for owner, manager, affiliate, and pending affiliate. These are static previews only and should be replaced with Cloudflare auth later.

## Cloudflare Pages Settings
- Framework preset: None
- Build command: echo "Static site - no build needed"
- Build output directory: /
