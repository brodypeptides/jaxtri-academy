-- Sprint 3.1 Direct Admin Invites uses the existing Sprint 3 invites table.
-- If Sprint 3 already works, there is no required migration for this sprint.

-- Optional sanity check: this should return one row named "invites".
SELECT name
FROM sqlite_master
WHERE type = 'table'
  AND name = 'invites';
