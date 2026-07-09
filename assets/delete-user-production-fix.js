(function () {
  function cleanText(value) {
    return String(value || '')
      .replace(/Delete test user/gi, 'Delete user')
      .replace(/Permanent delete is only for test users\. Type this email exactly to continue:/gi, 'This permanently deletes the user account. Type this email exactly to continue:')
      .replace(/test users/gi, 'users')
      .replace(/Sprint 5\.1 D1 migration/gi, 'production database migration');
  }

  function applyCopyFix(root) {
    const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const next = cleanText(node.nodeValue);
        return next !== node.nodeValue ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => { node.nodeValue = cleanText(node.nodeValue); });

    document.querySelectorAll('button,input,textarea,a').forEach((el) => {
      ['value', 'title', 'aria-label', 'placeholder'].forEach((attr) => {
        const raw = el.getAttribute(attr);
        if (!raw) return;
        const next = cleanText(raw);
        if (next !== raw) el.setAttribute(attr, next);
      });
    });
  }

  function wrapDeleteUser() {
    if (typeof window.deleteUser !== 'function' || window.deleteUser.__productionFixed) return;
    const originalDeleteUser = window.deleteUser;
    window.deleteUser = async function productionDeleteUser(id, email) {
      const typed = prompt(`This permanently deletes the user account. Type this email exactly to continue:\n\n${email}`);
      if (typed === null) return;
      if (typed.trim().toLowerCase() !== String(email).toLowerCase()) {
        alert('Email did not match. User was not deleted.');
        return;
      }
      if (!confirm(`Permanently delete ${email}? This cannot be undone.`)) return;
      const setCardStatusFn = window.setCardStatus || setCardStatus;
      try {
        if (typeof setCardStatusFn === 'function') setCardStatusFn(id, 'Deleting user...');
        const response = await fetch(`/api/admin/users/${id}/delete`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ confirm_email: typed }),
        });
        const data = await response.json().catch(() => ({ error: `Delete failed with HTTP ${response.status}.` }));
        if (!response.ok) {
          if (typeof setCardStatusFn === 'function') setCardStatusFn(id, data.error || 'Could not delete user.', 'error');
          else alert(data.error || 'Could not delete user.');
          return;
        }
        if (typeof window.loadUsers === 'function') await window.loadUsers();
        else location.reload();
      } catch (error) {
        const message = error?.message || 'Could not delete user.';
        if (typeof setCardStatusFn === 'function') setCardStatusFn(id, message, 'error');
        else alert(message);
      }
    };
    window.deleteUser.__productionFixed = true;
  }

  function run() {
    applyCopyFix(document.body || document.documentElement);
    wrapDeleteUser();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();

  setTimeout(run, 250);
  setTimeout(run, 1000);
  setInterval(run, 2500);
})();
