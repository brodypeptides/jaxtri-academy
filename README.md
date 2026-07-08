# Jaxtri Production Hard Cleanup — Fixed Windows Apply

This fixed patch replaces the broken PowerShell helper with a Node.js helper.

## What to do

1. Copy this ZIP's contents into the root of your `jaxtri-academy` repo.
2. Double-click:

```text
apply-production-hard-cleanup-fixed.bat
```

3. In GitHub Desktop, confirm these deletes are expected if they appear:

```text
functions/api/admin/webhook-test.js
functions/api/push/test.js
```

4. Before committing, delete these helper files/folders from the repo:

```text
apply-production-hard-cleanup-fixed.bat
tools/
```

5. Commit:

```text
production hard cleanup fixed
```

6. Push and wait for Cloudflare deploy success.

## Notes

- This patch hard-removes visible Sprint/test wording from source files.
- It adds production-named routes:
  - `/api/admin/webhook-verification`
  - `/api/push/verification`
- It safely removes old route files if present:
  - `/api/admin/webhook-test`
  - `/api/push/test`
