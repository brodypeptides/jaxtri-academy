# Jaxtri Sprint 6B.1 — WooCommerce Link + Coupon Tracking

This patch upgrades the WooCommerce connector so Jaxtri can credit affiliate sales from both:

- referral links such as `https://store.com/?ref=BRODY`
- WooCommerce coupon codes entered at checkout, such as `BRODY10`

## Attribution priority

When an order has both a referral cookie and one or more coupons, Jaxtri checks codes in this order:

1. WooCommerce coupon codes used at checkout
2. referral cookie/link code

Only codes that exist as active affiliate codes in Jaxtri will count. This prevents regular store coupons like `SALE20` from accidentally becoming affiliate commissions unless you intentionally create `SALE20` as an affiliate code.

## What changed

- WordPress plugin now sends `coupon_codes`, `referral_code`, and `affiliate_code_candidates`.
- Jaxtri webhook now checks all candidate codes and uses the first active affiliate code it finds.
- Sales notes now show whether the commission came from a coupon code or referral link.
- Existing referral-link tracking still works.
- No new D1 migration required.

## Files changed

- `functions/api/webhooks/woocommerce.js`
- `owner-commissions.html`
- `wordpress/jaxtri-affiliate-connector/jaxtri-affiliate-connector.php`
- `wordpress/jaxtri-wordpress-connector-plugin.zip`

## Install steps

1. Copy this package into your Jaxtri repo.
2. Keep your existing `wrangler.toml`.
3. Commit and push:

```text
sprint 6b.1 coupon code tracking
```

4. Upload the updated WordPress plugin ZIP from this package:

```text
wordpress/jaxtri-wordpress-connector-plugin.zip
```

or use the separate ZIP named:

```text
jaxtri-wordpress-connector-plugin-6b1.zip
```

## Testing

Test both paths:

### Referral link test

1. Generate an affiliate code in Jaxtri, for example `BRODY`.
2. Visit the WooCommerce store with `?ref=BRODY`.
3. Place a test order.
4. Confirm the sale appears in `Owner → Commissions`.

### Coupon code test

1. Make sure the affiliate code exists in Jaxtri.
2. Create/use a matching WooCommerce coupon code at checkout, such as `BRODY` or `BRODY10`.
3. Place a test order without clicking a referral link.
4. Confirm the sale appears in `Owner → Commissions`.

### Both-at-once test

1. Visit store with `?ref=AFFILIATEA`.
2. Checkout with coupon `AFFILIATEB`.
3. Jaxtri should credit the coupon match first.

If a checkout uses a coupon that is not an active affiliate code, Jaxtri falls back to the referral link if one exists.
