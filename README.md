# Sprint 4.2 — Full Team Chat Page

This patch keeps the movable Team tab, but adds a full-page chat workspace.

## Added

- `team.html` full-screen team chat page
- `assets/team-page.js` full-page chat logic
- Dashboard/nav links to Team Chat
- Full-width channel + DM messaging
- Larger message history area
- Bigger visible send/attachment composer
- Right-side conversation details and active-member list on desktop
- The compact side drawer now includes a **Full page** button

## D1

No new database migration is required if Sprint 4 tables already exist.

If you see errors about missing attachment columns, run these in D1:

```sql
ALTER TABLE direct_messages ADD COLUMN attachment_url TEXT;
ALTER TABLE direct_messages ADD COLUMN attachment_name TEXT;
ALTER TABLE channel_messages ADD COLUMN attachment_url TEXT;
ALTER TABLE channel_messages ADD COLUMN attachment_name TEXT;
```

If D1 says `duplicate column name`, that column already exists and you can ignore it.

## Test

1. Push this patch.
2. Open `/team.html` while logged in.
3. Send a General channel message.
4. Open People and test a DM.
5. Use the movable Team tab and click **Full page**.

Suggested commit message:

```text
sprint 4.2 full team chat page
```
