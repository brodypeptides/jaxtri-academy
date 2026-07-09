# Delete User Functional Hotfix Safe

This patch fixes the production user delete flow.

It adds:
- functions/api/admin/users/[id]/delete.js
- assets/delete-user-production-fix.js

It patches:
- owner-users.html wording and script include
- assets/session.js fallback loader

Apply:
1. Copy the contents of this folder into the jaxtri-academy repo root.
2. Run apply-delete-user-functional-hotfix-safe.bat.
3. Review GitHub Desktop.
4. Commit and push.

Commit message suggestion:
fix production user delete flow
