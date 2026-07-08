function dashboardFor(user) {
  if (!user) return '/login.html';
  if (user.status === 'pending') return '/pending.html';
  if (user.role === 'owner' || user.role === 'manager') return '/owner-dashboard.html';
  return '/academy-dashboard.html';
}

function currentPageName() {
  return location.pathname.split('/').pop() || 'index.html';
}

function privatePageAllowed(user) {
  const path = currentPageName();
  if (!user) return false;
  if (user.status === 'suspended') return false;
  if (user.status === 'pending') return path === 'pending.html';

  if (path === 'pending.html') return false;

  // Owner/manager command-center pages. Managers can open Users + Codes in read-only/user-safe mode
  // so they can help with affiliate-code setup without owner-level role/status edits.
  if (path === 'owner-users.html') return user.role === 'owner' || user.role === 'manager';
  if (path.startsWith('owner-')) return user.role === 'owner' || user.role === 'manager';
  return true;
}

function isCommandUser(user) {
  return user && (user.role === 'owner' || user.role === 'manager');
}

function navEscape(value) {
  return String(value || '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[c]));
}

function navLink(href, label) {
  const path = currentPageName();
  const active = path === href || (path === 'index.html' && href === 'owner-dashboard.html');
  return `<a${active ? ' class="active"' : ''} href="${navEscape(href)}">${navEscape(label)}</a>`;
}

function navGroup(title, links) {
  return `
    <div class="nav-group-label">${navEscape(title)}</div>
    ${links.map(([href, label]) => navLink(href, label)).join('')}
  `;
}

function installNavStyles() {
  if (document.querySelector('link[href="assets/navigation-categories.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'assets/navigation-categories.css';
  document.head.appendChild(link);
}

function installPersistentSideNav(user) {
  const sidebar = document.querySelector('.app-sidebar');
  const nav = sidebar?.querySelector('.side-nav');
  if (!sidebar || !nav) return;

  installNavStyles();

  const commandMode = isCommandUser(user);
  sidebar.dataset.navMode = commandMode ? 'command' : 'academy';

  const brandStrong = sidebar.querySelector('.side-brand strong');
  const brandSmall = sidebar.querySelector('.side-brand small');
  if (brandStrong) brandStrong.textContent = commandMode ? 'Jaxtri' : 'Academy';
  if (brandSmall) brandSmall.textContent = commandMode ? 'Command Center' : 'Affiliate Portal';

  if (commandMode) {
    nav.innerHTML = [
      navGroup('Command', [
        ['owner-dashboard.html', 'Overview'],
      ]),
      navGroup('People', [
        ['owner-recruitment.html', 'Applications'],
        ['owner-admin.html', 'Invites'],
        ['owner-users.html', 'Users + Codes'],
      ]),
      navGroup('Money', [
        ['owner-commissions.html', 'Commissions'],
        ['owner-payouts.html', 'Payouts'],
        ['my-affiliate.html', 'My Affiliate'],
      ]),
      navGroup('Community', [
        ['owner-feed-review.html', 'Feed Review'],
        ['team.html', 'Team Chat'],
        ['academy-dashboard.html', 'Academy View'],
      ]),
    ].join('');
    return;
  }

  nav.innerHTML = [
    navGroup('Start', [
      ['academy-dashboard.html', 'Dashboard'],
    ]),
    navGroup('Earn', [
      ['my-affiliate.html', 'My Affiliate'],
      ['commissions.html', 'Commission Ledger'],
    ]),
    navGroup('Learn + Create', [
      ['training.html', 'Training'],
      ['resources.html', 'Resources'],
      ['content-vault.html', 'Content Vault'],
      ['feed.html', 'Feed'],
    ]),
    navGroup('Team', [
      ['team.html', 'Team Chat'],
    ]),
  ].join('');
}

async function loadSession(){
  const target=document.getElementById('me');
  try{
    const r=await fetch('/api/me');
    const d=await r.json();
    if(!r.ok){location.href='/login.html';return null}

    if (!privatePageAllowed(d.user)) {
      if (d.user.status === 'suspended') {
        await fetch('/api/logout', { method: 'POST' }).catch(() => {});
        location.href = '/login.html';
        return null;
      }
      location.href = dashboardFor(d.user);
      return null;
    }

    window.JaxtriCurrentUser = d.user;
    installPersistentSideNav(d.user);

    if(target) target.textContent=`Logged in as ${d.user.full_name} — ${d.user.role}${d.user.company_title?` (${d.user.company_title})`:''}`;
    return d.user;
  }catch(e){
    if(target) target.textContent='Could not load session.';
    return null;
  }
}
async function logout(){await fetch('/api/logout',{method:'POST'});location.href='/login.html'}
document.getElementById('logout')?.addEventListener('click',logout);
loadSession();
