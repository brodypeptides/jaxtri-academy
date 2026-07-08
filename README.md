# Jaxtri Owner Commissions Theme Fix

This patch fixes `owner-commissions.html` falling back to the old dark theme.

## Cause

The page was only loading:

```html
<link rel="stylesheet" href="assets/styles.css">
```

So the frost-white/logo-color override was not being applied.

## Files changed

- `owner-commissions.html`

## What changed

The page now loads:

```html
<link rel="stylesheet" href="assets/styles.css"><link rel="stylesheet" href="assets/frost-theme.css"><link rel="stylesheet" href="assets/navigation-categories.css">
```

## D1

No database migration needed.

## Commit message

```text
owner commissions frost theme fix
```
