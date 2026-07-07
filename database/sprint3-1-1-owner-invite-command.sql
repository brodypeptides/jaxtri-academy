-- Sprint 3.1.1 helper: command-line-only owner invite
-- Replace OWNER_EMAIL_HERE before running.

INSERT INTO invites (
  token,
  application_id,
  email,
  role,
  status,
  expires_at,
  created_by
)
VALUES (
  lower(hex(randomblob(24))),
  NULL,
  'OWNER_EMAIL_HERE',
  'owner',
  'active',
  datetime('now', '+14 days'),
  (SELECT id FROM users WHERE role = 'owner' ORDER BY id ASC LIMIT 1)
);

SELECT token, email, role, status, expires_at
FROM invites
WHERE email = 'OWNER_EMAIL_HERE'
ORDER BY id DESC
LIMIT 1;
