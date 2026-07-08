(function(){
  const replacements = [
    ['Use this for testing, private tracking, or manually entered orders until the WordPress connector is ready.', 'Use this for verified private tracking or manually entered orders.'],
    ['For now they are useful for planning, manual tracking, and testing.', 'Use them for live referral links, coupon matching, planning, and manual tracking.'],
    ['test webhook', 'verification webhook'],
    ['Send test webhook', 'Send verification webhook'],
    ['testing center', 'verification center'],
    ['safe test event', 'safe verification event'],
    ['place test WooCommerce order', 'place a WooCommerce verification order'],
    ['testing', 'verification'],
    ['Testing', 'Verification'],
    ['Delete test user', 'Delete user'],
    ['Send test', 'Send verification'],
    ['test notification', 'verification notification'],
    ['Test notification', 'Verification notification']
  ];

  function replaceTextNode(node){
    let value = node.nodeValue;
    let next = value;
    for (const [from, to] of replacements) {
      next = next.split(from).join(to);
    }
    if (next !== value) node.nodeValue = next;
  }

  function walk(root){
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node){
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (['SCRIPT','STYLE','TEXTAREA','INPUT','CODE'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return replacements.some(([from]) => node.nodeValue.includes(from)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(replaceTextNode);
  }

  function apply(){
    document.body?.classList.add('production-mode');
    walk(document.body || document.documentElement);

    document.querySelectorAll('button,input,textarea').forEach((el) => {
      ['placeholder','title','aria-label','value'].forEach((attr) => {
        const raw = el.getAttribute(attr);
        if (!raw) return;
        let next = raw;
        for (const [from, to] of replacements) next = next.split(from).join(to);
        if (next !== raw) el.setAttribute(attr, next);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();

  setTimeout(apply, 250);
  setTimeout(apply, 1000);
})();
