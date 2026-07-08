const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const targets = [
  {
    file: 'owner-users.html',
    replacements: [
      ['Delete test user', 'Delete user'],
      ['Permanent delete is only for test users. Type this email exactly to continue:', 'This permanently deletes the user account. Type this email exactly to continue:'],
      ['Commission editing is disabled until the Sprint 5.1 D1 migration is run.', 'Commission editing is disabled until the production commission database migration is complete.'],
      ['Run migration first', 'Database setup needed']
    ]
  },
  {
    file: 'owner-commissions.html',
    replacements: [
      ['Delete this test/manual sale? Paid sales cannot be deleted.', 'Permanently delete this manual sale? Paid sales cannot be deleted.'],
      ['test/manual sale', 'manual sale'],
      ['Test webhook', 'Verification webhook'],
      ['test webhook', 'verification webhook'],
      ['test WooCommerce order', 'WooCommerce verification order'],
      ['testing center', 'verification center'],
      ['testing', 'verification']
    ]
  },
  {
    file: 'assets/pwa-install.js',
    replacements: [
      ['Send test', 'Send verification'],
      ['Sending test notification...', 'Sending verification notification...'],
      ['Could not send test push.', 'Could not send verification push.'],
      ['Test sent to ', 'Verification sent to '],
      ['Could not send test notification.', 'Could not send verification notification.']
    ]
  },
  {
    file: 'functions/api/push/test.js',
    optional: true,
    replacements: [
      ['Push notification test', 'Push notification verification'],
      ['Could not send push test.', 'Could not send push verification.'],
      ['Push table missing. Run database/sprint9-1-pwa-push.sql in D1 first.', 'Push table missing. Run the production push database migration in D1 first.']
    ]
  },
  {
    file: 'functions/api/push/verification.js',
    optional: true,
    replacements: [
      ['Push notification test', 'Push notification verification'],
      ['Could not send push test.', 'Could not send push verification.'],
      ['Push table missing. Run database/sprint9-1-pwa-push.sql in D1 first.', 'Push table missing. Run the production push database migration in D1 first.']
    ]
  }
];

let touched = 0;
let missingRequired = [];
for (const target of targets) {
  const filePath = path.join(repoRoot, target.file);
  if (!fs.existsSync(filePath)) {
    if (!target.optional) missingRequired.push(target.file);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const before = content;
  for (const [from, to] of target.replacements) {
    content = content.split(from).join(to);
  }
  if (content !== before) {
    fs.writeFileSync(filePath, content, 'utf8');
    touched += 1;
    console.log(`Updated ${target.file}`);
  } else {
    console.log(`No changes needed in ${target.file}`);
  }
}

if (missingRequired.length) {
  console.error(`Missing required file(s): ${missingRequired.join(', ')}`);
  process.exit(1);
}

console.log(`Hotfix complete. Files changed: ${touched}`);
