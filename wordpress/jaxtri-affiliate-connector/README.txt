Jaxtri Affiliate Connector
==========================

This WordPress plugin connects WooCommerce order events to Jaxtri Academy.

Install:
1. Zip the jaxtri-affiliate-connector folder, or upload jaxtri-wordpress-connector-plugin.zip.
2. In WordPress Admin, go to Plugins -> Add New -> Upload Plugin.
3. Activate the plugin.
4. Go to Settings -> Jaxtri Affiliate.
5. Set the Academy webhook URL: https://YOUR-ACADEMY.pages.dev/api/webhooks/woocommerce
6. Set the same webhook secret that you configured in Cloudflare as JAXTRI_WC_WEBHOOK_SECRET.
7. Keep referral parameter as ref unless you want another parameter.

Use affiliate links like:
https://YOURSTORE.com/?ref=AFFILIATECODE

The plugin saves the referral code in a cookie and sends qualifying WooCommerce order updates to Jaxtri Academy.
