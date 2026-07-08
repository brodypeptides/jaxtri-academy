# Jaxtri Frost White + Logo Color Theme

This patch changes the whole site/app to a clean frost-white dashboard look with Jaxtri green/cyan accents.

## What changed

- White/frost background instead of dark/off-cream
- Green + cyan accent colors throughout
- Cleaner cards and sidebars
- Smaller, more professional buttons
- Whole-site theme file: `assets/frost-theme.css`
- Every HTML page now loads the theme after `assets/styles.css`

## Files changed

- `assets/frost-theme.css`
- `assets/styles.css` and existing asset files included so replacing the `assets` folder on Mac does not delete needed files
- All `.html` pages updated to include the frost theme

## Install

Copy the contents of this folder into your repo. Keep your existing `wrangler.toml`.

Commit message:

```text
frost white logo color theme
```

No D1 changes needed.

## Test

Open these first:

```text
/
apply.html
login.html
owner-dashboard.html
academy-dashboard.html
team.html
owner-commissions.html
```

The site should feel white/frosted, but still use Jaxtri green/cyan accents instead of harsh plain white.
