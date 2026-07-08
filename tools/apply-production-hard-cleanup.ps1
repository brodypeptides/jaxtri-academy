$ErrorActionPreference = 'Stop'
$Root = (Get-Location).Path

function Replace-InFile {
  param(
    [string]$Path,
    [array]$Pairs
  )
  $Full = Join-Path $Root $Path
  if (!(Test-Path $Full)) {
    Write-Host "SKIP missing $Path"
    return
  }
  $Text = Get-Content -Raw -Encoding UTF8 $Full
  foreach ($Pair in $Pairs) {
    $Text = $Text.Replace($Pair[0], $Pair[1])
  }
  Set-Content -Path $Full -Value $Text -Encoding UTF8 -NoNewline
  Write-Host "Updated $Path"
}

Replace-InFile 'owner-commissions.html' @(
  @('Sprint 6A', 'Production'),
  @('Sprint 6B', 'WooCommerce'),
  @('Sprint 6G', 'WooCommerce'),
  @('Use this for testing, private tracking, or manually entered orders until the WordPress connector is ready.', 'Use this for verified private tracking or manually entered orders.'),
  @('These codes can later power WordPress links like <code>?ref=CODE</code>. For now they are useful for planning, manual tracking, and testing.', 'These codes power live referral links, coupon matching, planning, and manual tracking.'),
  @('Workflow: generate affiliate code → use store link preview and/or matching coupon code → install updated WordPress plugin → set matching secret → test webhook → place test WooCommerce order.', 'Workflow: generate affiliate code → use store link preview and/or matching coupon code → install or update the WordPress plugin → set matching secret → place a WooCommerce verification order.'),
  @('onclick="sendTestWebhook()"', 'onclick="sendVerificationWebhook()"'),
  @('Send test webhook', 'Send verification webhook'),
  @('This is the Jaxtri-side testing center. It does not require the store owner to be online. It checks your Cloudflare secret, D1 tables, webhook event log table, and sends a safe test event through the live webhook endpoint.', 'This is the Jaxtri-side verification center. It does not require the store owner to be online. It checks your Cloudflare secret, D1 tables, and webhook event log table, then sends a safe verification request through the live webhook endpoint.'),
  @('Jaxtri side is ready for WooCommerce testing.', 'Jaxtri side is ready for WooCommerce verification.'),
  @('Jaxtri side needs setup before live store testing.', 'Jaxtri side needs setup before live store verification.'),
  @('database/sprint6g-webhook-events.sql', 'database/production-final-missing-tables.sql'),
  @('async function sendTestWebhook()', 'async function sendVerificationWebhook()'),
  @("if(!confirm('Send a safe test webhook through the live Jaxtri endpoint?')) return;", "if(!confirm('Send a safe verification webhook through the live Jaxtri endpoint?')) return;"),
  @("wcSetupBox.textContent='Sending test webhook...';", "wcSetupBox.textContent='Sending verification webhook...';"),
  @("fetch('/api/admin/webhook-test'", "fetch('/api/admin/webhook-verification'"),
  @("d.error||'Test webhook failed.'", "d.error||'Verification webhook failed.'"),
  @("alert('Test webhook reached the live endpoint. Check the logs below.');", "alert('Verification webhook reached the live endpoint. Check the logs below.');"),
  @("if(!confirm('Delete this test/manual sale? Paid sales cannot be deleted.'))return;", "if(!confirm('Delete this manual sale? Paid sales cannot be deleted.'))return;")
)

Replace-InFile 'notifications.html' @(
  @('Sprint 9.1', 'Notifications'),
  @('Send test', 'Send verification')
)

Replace-InFile 'assets/pwa-install.js' @(
  @('async function sendTestPush()', 'async function sendVerificationPush()'),
  @("setPushStatus('Sending test notification...');", "setPushStatus('Sending verification notification...');"),
  @("fetch('/api/push/test'", "fetch('/api/push/verification'"),
  @("data.error || 'Could not send test push.'", "data.error || 'Could not send push verification.'"),
  @('Test sent to ${data.sent}', 'Verification sent to ${data.sent}'),
  @("error.message || 'Could not send test notification.'", "error.message || 'Could not send verification notification.'"),
  @('id="jaxtriTestPushBtn"', 'id="jaxtriVerificationPushBtn"'),
  @('Send test', 'Send verification'),
  @("document.getElementById('jaxtriTestPushBtn')?.addEventListener('click', sendTestPush);", "document.getElementById('jaxtriVerificationPushBtn')?.addEventListener('click', sendVerificationPush);"),
  @('const testBtn = document.getElementById(''jaxtriTestPushBtn'');', 'const verificationBtn = document.getElementById(''jaxtriVerificationPushBtn'');'),
  @('if (testBtn) testBtn.disabled = true;', 'if (verificationBtn) verificationBtn.disabled = true;'),
  @('if (testBtn) testBtn.disabled = !enabled;', 'if (verificationBtn) verificationBtn.disabled = !enabled;'),
  @('window.JaxtriPwa = { boot, enablePush, disablePush, sendTestPush, renderPwaPanel, resetInstallPrompt };', 'window.JaxtriPwa = { boot, enablePush, disablePush, sendVerificationPush, renderPwaPanel, resetInstallPrompt };')
)

Replace-InFile 'functions/api/webhooks/woocommerce.js' @(
  @('Sprint 6A commission tables are missing. Run Sprint 6A migration first.', 'Commission tables are missing. Run the production database migration first.'),
  @("if (clean(payload.event).toLowerCase() === 'test') {", "if (clean(payload.event).toLowerCase() === 'verification') {"),
  @("message: 'Test webhook received.'", "message: 'Verification webhook received.'"),
  @("return json({ ok: true, test: true, message: 'Jaxtri WooCommerce webhook is reachable.' });", "return json({ ok: true, verification: true, message: 'Jaxtri WooCommerce webhook is reachable.' });")
)

Replace-InFile 'functions/api/admin/users/[id]/profile.js' @(
  @('Run the Sprint 7-9 migration first.', 'Run the production database migration first.')
)

Replace-InFile 'functions/api/push/subscription.js' @(
  @('Push table missing. Run database/sprint9-1-pwa-push.sql in D1 first.', 'Push table missing. Run the production database migration first.')
)

Replace-InFile 'service-worker.js' @(
  @('jaxtri-academy-production-logo-v1', 'jaxtri-academy-production-hard-cleanup-v1')
)

Write-Host 'Production hard cleanup replacements complete.'
