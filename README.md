# Jaxtri Delete User Production Wording Hotfix

This hotfix removes production-facing "test user" wording from the user management page.

## Apply

1. Copy this folder's contents into the root of your `jaxtri-academy` repo.
2. Double-click `apply-delete-user-production-hotfix.bat`.
3. Review changes in GitHub Desktop.
4. Delete `apply-delete-user-production-hotfix.bat` and `tools/` before committing.
5. Commit and push.

Expected main change:

- `owner-users.html`: `Delete test user` becomes `Delete user`.
- The delete confirmation prompt no longer says the feature is only for test users.

It also lightly cleans matching production wording in commissions/PWA files if those old phrases are present.
