# Jaxtri persistent Command Center sidebar

This patch keeps the Command Center sidebar categories consistent on every internal page.

## Files changed

- `assets/session.js`
- `assets/navigation-categories.css`

## What it does

- Keeps the top Jaxtri / Command Center sidebar card visible.
- Makes the sidebar links scroll inside the sidebar instead of forcing the whole page down.
- Rebuilds the sidebar into the same categories on every protected page:
  - Command
  - People
  - Money
  - Community
- Gives affiliates their own consistent Academy sidebar.
- Lets managers open Users + Codes in safe read-only/code-helper mode.

## D1

No migration needed.

## Commit message

persistent command center sidebar
