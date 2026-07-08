(function(){
  const replacements = [
    ['SPRINT 6A', 'Production'],
    ['SPRINT 6B', 'WooCommerce'],
    ['SPRINT 6G', 'WooCommerce'],
    ['SPRINT 7', 'Profile'],
    ['SPRINT 8', 'Notifications'],
    ['SPRINT 9', 'Mobile App'],
    ['Sprint 6A', 'Production'],
    ['Sprint 6B', 'WooCommerce'],
    ['Sprint 6G', 'WooCommerce'],
    ['Sprint 7', 'Profile'],
    ['Sprint 8', 'Notifications'],
    ['Sprint 9', 'Mobile App'],
    ['Use this for testing, private tracking, or manually entered orders until the WordPress connector is ready.', 'Use this for verified private tracking or manually entered orders.'],
    ['For now they are useful for planning, manual tracking, and testing.', 'Use them for live referral links, coupon matching, planning, and manual tracking.'],
    ['This is the Jaxtri-side testing center.', 'This is the Jaxtri-side verification center.'],
    ['This is the Jaxtri-side testing center', 'This is the Jaxtri-side verification center'],
    ['testing center', 'verification center'],
    ['safe test event', 'safe verification event'],
    ['test webhook', 'verification webhook'],
    ['Test webhook', 'Verification webhook'],
    ['Send test webhook', 'Send verification webhook'],
    ['Send Test Webhook', 'Send Verification Webhook'],
    ['place test WooCommerce order', 'place a WooCommerce verification order'],
    ['test WooCommerce order', 'WooCommerce verification order'],
    ['testing', 'verification'],
    ['Testing', 'Verification'],
    ['Delete test user', 'Delete user'],
    ['Send test', 'Send verification'],
    ['test notification', 'verification notification'],
    ['Test notification', 'Verification notification'],
    ['Run the Sprint 7-9 migration first.', 'Run the production database migration first.'],
    ['Run the Sprint 7-9 migration first', 'Run the production database migration first']
  ];

  function cleanProductionCopy(value){
    let next = String(value || '');
    for (const [from, to] of replacements) next = next.split(from).join(to);
    next = next.replace(/\bSprint\s+\d[\w.\-]*(\s*[–—-]\s*)?/gi, (match, sep) => sep ? '' : 'Production');
    next = next.replace(/\bSPRINT\s+\d[\w.\-]*(\s*[–—-]\s*)?/g, (match, sep) => sep ? '' : 'Production');
    next = next.replace(/\bRun the Production\s+migration/gi, 'Run the production database migration');
    next = next.replace(/\btest\s+webhook\b/gi, 'verification webhook');
    next = next.replace(/\btest\s+notification\b/gi, 'verification notification');
    next = next.replace(/\btest\s+event\b/gi, 'verification event');
    next = next.replace(/\btesting\b/gi, 'verification');
    next = next.replace(/\s{2,}/g, ' ');
    return next;
  }

  function replaceTextNode(node){
    const raw = node.nodeValue;
    const next = cleanProductionCopy(raw);
    if (next !== raw) node.nodeValue = next;
  }

  function walk(root){
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node){
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (['SCRIPT','STYLE','TEXTAREA','INPUT','CODE'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        const next = cleanProductionCopy(node.nodeValue);
        return next !== node.nodeValue ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(replaceTextNode);
  }

  function apply(){
    if (!document.documentElement) return;
    document.body?.classList.add('production-mode');
    walk(document.body || document.documentElement);

    document.querySelectorAll('button,input,textarea,a').forEach((el) => {
      ['placeholder','title','aria-label','value'].forEach((attr) => {
        const raw = el.getAttribute(attr);
        if (!raw) return;
        const next = cleanProductionCopy(raw);
        if (next !== raw) el.setAttribute(attr, next);
      });
    });

    document.querySelectorAll('.eyebrow').forEach((el) => {
      const raw = el.textContent || '';
      const next = cleanProductionCopy(raw).trim();
      if (next !== raw.trim()) el.textContent = next;
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();

  setTimeout(apply, 100);
  setTimeout(apply, 350);
  setTimeout(apply, 1000);
  setInterval(apply, 2500);
})();
