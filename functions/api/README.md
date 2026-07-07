Cloudflare Pages Functions placeholder.
Next backend steps:
- POST /api/applications creates application rows
- POST /api/auth/login verifies password and creates session cookie
- POST /api/content creates affiliate/owner content as draft or pending_review
- POST /api/content/:id/review lets owner/manager approve, reject, archive
- GET /api/me returns current user and role
