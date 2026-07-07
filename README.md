# Jaxtri Platform Phase 1

Public site: **Jaxtri Labs Affiliate Program**
Private site: **Jaxtri Academy**

This is the first Cloudflare-ready foundation.

## Cloudflare Pages settings

- Framework preset: None
- Build command: `echo "Static site - no build needed"`
- Build output directory: `/`
- Deploy command: leave blank if possible. If required, use `echo "No deploy command needed"`.

## Backend scaffold

- `functions/api/*` contains Pages Functions placeholders.
- `database/schema.sql` contains the D1 schema draft.

## Next backend steps

1. Create D1 database.
2. Bind it to Cloudflare Pages as `DB`.
3. Run `database/schema.sql`.
4. Implement setup owner endpoint.
5. Implement auth/session handling.
6. Implement application insert + owner approval.
