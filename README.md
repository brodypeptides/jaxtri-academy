# Sprint 6E — Navigation Cleanup + Affiliate Code Controls

This patch cleans up the dashboard structure and adds affiliate-code setup directly to user profiles.

## What changed

- Adds grouped dashboard categories so the site feels less scattered.
- Adds `assets/navigation-categories.css` for hub cards and sidebar group labels.
- Updates `academy-dashboard.html` into clear affiliate categories:
  - Earn
  - Learn
  - Connect
- Updates `owner-dashboard.html` into clear owner categories:
  - People
  - Money
  - Community
- Updates `owner-users.html` into **Users + Affiliate Codes**.
- Adds affiliate-code controls to each user profile card.
- Affiliates still cannot change their own code or commission rate.
- Owners can attach a code to owner, manager, and affiliate profiles.
- Managers can attach codes to manager/affiliate profiles, but not owner profiles.
- Owner role/status/commission changes are still protected and D1-only.

## Files included

```text
assets/navigation-categories.css
academy-dashboard.html
owner-dashboard.html
owner-users.html
functions/api/admin/users.js
functions/api/admin/affiliate-codes.js
functions/api/admin/affiliate-codes/[id].js
functions/api/admin/commissions.js
```

## D1 migration

No new migration is required for this patch.

This patch uses the existing Sprint 6A tables:

```text
affiliate_codes
affiliate_sales
```

If affiliate code controls say the code table is missing, run the Sprint 6A commission migration first.

## How to add your owner code

After pushing this patch:

1. Login as owner.
2. Go to `owner-users.html`.
3. Search your owner profile.
4. In **Affiliate code**, enter:

```text
brody
```

5. Click **Set code**.

Your owner profile can now receive WooCommerce/coupon attribution through that code, as long as your owner user also has a valid commission percentage in D1.

## Commit message

```text
sprint 6e navigation cleanup affiliate code controls
```
