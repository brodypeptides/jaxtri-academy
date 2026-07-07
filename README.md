# Jaxtri Academy — Sprint 4 Team Messaging

Sprint 4 through 4.4 adds a Discord/Teams-style team layer to the app.

## What is included

- Slide-out roster panel on logged-in pages
- Online / away / offline presence
- Direct messages
- Unread message badges
- Near-realtime polling refresh
- Team channels
- Staff-only Leadership channel
- Owner/manager channel creation
- Link and image sharing in messages

## Important note about file sharing

Sprint 4.4 supports sharing **file/image URLs**. Real binary uploads require storage such as Cloudflare R2, which should be a later sprint. This keeps the current version free, stable, and simple.

## Install

1. Copy the contents of this package into your repo.
2. Keep your existing `wrangler.toml`.
3. Commit and push.
4. Before testing, run this D1 migration:

```sql
-- database/sprint4-team-messaging.sql
```

Run the full contents of `database/sprint4-team-messaging.sql` in Cloudflare D1.

## New files

```text
assets/roster.js
functions/lib/team.js
functions/api/presence.js
functions/api/roster.js
functions/api/messages/direct.js
functions/api/channels.js
functions/api/channels/[id]/messages.js
database/sprint4-team-messaging.sql
```

## Updated files

The logged-in pages now include:

```html
<script src="assets/roster.js"></script>
```

Updated pages include:

```text
academy-dashboard.html
feed.html
training.html
content-vault.html
resources.html
owner-dashboard.html
owner-recruitment.html
owner-admin.html
assets/styles.css
```

## Permissions

- Owner can message everyone.
- Manager can message everyone.
- Affiliate can message owners/managers.
- Affiliates cannot DM other affiliates yet.
- General channel is visible to everyone.
- Leadership channel is visible to owners/managers only.
- Owners/managers can create channels from the roster panel.

## Presence logic

- Online: active in the last 2 minutes
- Away: active in the last 15 minutes
- Offline: older than 15 minutes

The app refreshes presence, roster, channels, and unread counts through polling. This gives a live feel without WebSocket infrastructure.

## Test flow

1. Log in as owner.
2. Open the floating **Team** button.
3. Confirm users appear in the roster.
4. Open **Channels**.
5. Send a message in **General**.
6. Invite/create a second user account.
7. Log in as that user in another browser/incognito window.
8. Send DMs and confirm unread badges appear.
9. Paste an image URL into the attachment URL box and send it.

## Future upgrade

Sprint 5 can add actual uploads with Cloudflare R2, message search, push notifications, reactions, typing indicators, and eventually calls/meetings with WebRTC.
