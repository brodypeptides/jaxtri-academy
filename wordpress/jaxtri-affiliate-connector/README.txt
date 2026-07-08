Jaxtri Affiliate Connector

Tracks Jaxtri affiliate referral links and WooCommerce coupon codes.

Supported tracking:
- URL referral parameter, default ?ref=CODE
- WooCommerce checkout coupon codes

Attribution priority:
1. Coupon code match
2. Referral cookie/link fallback

Settings:
WordPress Admin -> Settings -> Jaxtri Affiliate

Webhook URL:
https://YOUR-ACADEMY.pages.dev/api/webhooks/woocommerce

The webhook secret must match the JAXTRI_WC_WEBHOOK_SECRET environment variable in Cloudflare Pages.
