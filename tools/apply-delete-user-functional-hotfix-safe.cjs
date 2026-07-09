const fs = require('fs');
const path = require('path');

const root = process.cwd();
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function write(rel, content) { fs.writeFileSync(path.join(root, rel), content, 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(root, rel)); }

function replaceAll(content, from, to) {
  return content.split(from).join(to);
}

let changed = [];

if (exists('owner-users.html')) {
  let html = read('owner-users.html');
  const before = html;
  html = replaceAll(html, 'Delete test user', 'Delete user');
  html = replaceAll(html, 'Permanent delete is only for test users. Type this email exactly to continue:', 'This permanently deletes the user account. Type this email exactly to continue:');
  html = replaceAll(html, 'Commission editing is disabled until the Sprint 5.1 D1 migration is run.', 'Commission editing is disabled until the production database migration is complete.');
  if (!html.includes('assets/delete-user-production-fix.js')) {
    html = html.replace('<script src="assets/session.js"></script>', '<script src="assets/session.js"></script><script src="assets/delete-user-production-fix.js"></script>');
  }
  if (html !== before) {
    write('owner-users.html', html);
    changed.push('owner-users.html');
  }
}

if (exists('assets/session.js')) {
  let session = read('assets/session.js');
  const before = session;
  if (!session.includes("assets/delete-user-production-fix.js")) {
    session = session.replace('installProductionMode();', "installProductionMode();\n    installScript('assets/delete-user-production-fix.js');");
  }
  if (session !== before) {
    write('assets/session.js', session);
    changed.push('assets/session.js');
  }
}

console.log('Safe delete-user hotfix applied. Changed: ' + (changed.length ? changed.join(', ') : 'no existing files needed edits'));
console.log('New files should also be present: functions/api/admin/users/[id]/delete.js and assets/delete-user-production-fix.js');
