# Jaxtri Academy — Sprint 4.3 Dashboard + Feed Polish

This patch focuses on polish and current-feature stability before the next major feature sprint.

## What changed

- Cleaner dashboard style with smaller buttons/cards and less flashy gradients.
- Brand colors moved closer to the Jaxtri logo: black/charcoal + teal/cyan glow.
- Owner Command Center now has a left sidebar:
  - Overview
  - Recruitment
  - Feed Review
  - Admin + Invites
  - Team Chat
  - Academy View
- Academy dashboard now has a sidebar and a more dashboard-like layout.
- Resources, Training, Content Vault, and Feed now have back/quick-navigation buttons.
- Adds a reviewed social feed system:
  - Affiliates/managers/owners submit posts from dashboard/feed.
  - Posts go to pending review.
  - Owner/manager reviews in `owner-feed-review.html`.
  - Published posts show in the main feed and dashboard feed preview.

## D1 migration

Run this once in Cloudflare D1 Console before testing the feed review system:

```sql
CREATE TABLE IF NOT EXISTS feed_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  media_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected','archived')),
  review_note TEXT,
  reviewed_by INTEGER,
  reviewed_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_feed_posts_status ON feed_posts(status);
CREATE INDEX IF NOT EXISTS idx_feed_posts_author ON feed_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_feed_posts_published_at ON feed_posts(published_at);
```

Or run:

```text
database/sprint4-3-dashboard-feed.sql
```

## Test flow

1. Log in as owner.
2. Open `owner-dashboard.html` and confirm sidebar/cards look cleaner.
3. Open `academy-dashboard.html` and submit a feed post.
4. Open `owner-feed-review.html`.
5. Publish the pending post.
6. Open `feed.html` or `academy-dashboard.html` and confirm the post appears.
7. Test mobile sidebar/layout and back buttons on Resources/Training/Vault.

## Suggested commit message

```text
sprint 4.3 dashboard and feed polish
```
