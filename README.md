# Jaxtri Academy — Sprint 4.1.1 Chat Composer Fix

This is a small UI patch for the Sprint 4/4.1 Team roster panel.

## What it fixes

- Keeps the lower chat composer visible inside the roster drawer.
- Makes the message history area shrink correctly on shorter screens.
- Uses `100dvh` so mobile browser bars do not hide the bottom controls.
- Adds safer bottom padding for devices with safe-area insets.
- Compacts the attachment/link box on short screens.

## No database changes

No D1 migration is required.

## Install

Copy this package into the repo, keeping your existing `wrangler.toml`.

Commit message:

```text
sprint 4.1.1 chat composer fix
```
