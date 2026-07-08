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
  if (path === 'owner-users.html') return user.role === 'owner' || user.role === 'manager';
  if (path === 'owner-user-profile.html') return user.role === 'owner' || user.role === 'manager';
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

function installStylesheet(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function installPwaShell(user) {
  installStylesheet('assets/mobile-app.css');

  if (!document.querySelector('link[rel="manifest"]')) {
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = 'manifest.json';
    document.head.appendChild(manifest);
  }

  if (!document.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#f7fbff';
    document.head.appendChild(meta);
  }

  if ('serviceWorker' in navigator && ['https:', 'http:'].includes(location.protocol)) {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  }

  installMobileBottomNav(user);
}

function bottomNavLink(href, label) {
  const path = currentPageName();
  const active = path === href;
  const isAlerts = href === 'notifications.html';
  return `<a${active ? ' class="active"' : ''}${isAlerts ? ' data-jaxtri-alert-nav="1"' : ''} href="${navEscape(href)}"><span>${navEscape(label)}</span>${isAlerts ? '<b id="jaxtriMobileAlertCount" class="jaxtri-mobile-alert-count">0</b>' : ''}</a>`;
}

function installMobileBottomNav(user) {
  if (document.querySelector('.jaxtri-mobile-nav')) return;
  const isProtectedApp = document.body.classList.contains('dashboard-v2') || document.body.classList.contains('team-page-body');
  if (!isProtectedApp) return;

  const links = isCommandUser(user)
    ? [
        ['owner-dashboard.html', 'Home'],
        ['owner-users.html', 'People'],
        ['owner-commissions.html', 'Money'],
        ['notifications.html', 'Alerts'],
        ['team.html', 'Chat'],
      ]
    : [
        ['academy-dashboard.html', 'Home'],
        ['my-affiliate.html', 'Earn'],
        ['training.html', 'Learn'],
        ['notifications.html', 'Alerts'],
        ['team.html', 'Chat'],
      ];

  const nav = document.createElement('nav');
  nav.className = 'jaxtri-mobile-nav';
  nav.innerHTML = links.map(([href, label]) => bottomNavLink(href, label)).join('');
  document.body.appendChild(nav);
}


function isProtectedAppPage() {
  return document.body.classList.contains('dashboard-v2') || document.body.classList.contains('team-page-body');
}

function compactCount(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return '0';
  return number > 99 ? '99+' : String(number);
}

function updateAlertBadges(total, high = 0) {
  const label = compactCount(total);
  const desktop = document.getElementById('jaxtriAlertCount');
  const mobile = document.getElementById('jaxtriMobileAlertCount');
  const desktopChip = document.querySelector('.jaxtri-alert-chip');
  const mobileChip = document.querySelector('[data-jaxtri-alert-nav="1"]');

  if (desktop) desktop.textContent = label;
  if (mobile) mobile.textContent = label;

  [desktopChip, mobileChip].forEach((chip) => {
    if (!chip) return;
    chip.classList.toggle('has-alerts', Number(total || 0) > 0);
    chip.classList.toggle('high', Number(high || 0) > 0);
    chip.title = Number(total || 0) > 0 ? `${total} alert${Number(total) === 1 ? '' : 's'}${Number(high || 0) > 0 ? `, ${high} high priority` : ''}` : 'No current alerts';
  });
}

async function refreshAlertBadges() {
  try {
    const response = await fetch('/api/notifications', { headers: { accept: 'application/json' } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not load alerts.');
    const total = data.counts?.total ?? (data.notifications || []).length;
    const high = data.counts?.high ?? (data.notifications || []).filter((item) => item.severity === 'high').length;
    updateAlertBadges(total, high);
  } catch {
    const desktop = document.getElementById('jaxtriAlertCount');
    const mobile = document.getElementById('jaxtriMobileAlertCount');
    if (desktop) desktop.textContent = '!';
    if (mobile) mobile.textContent = '!';
  }
}

function installDesktopAlertChip(user) {
  if (!isProtectedAppPage()) return;
  const nav = document.querySelector('.header .nav');
  if (!nav || document.querySelector('.jaxtri-alert-chip')) return;

  const chip = document.createElement('a');
  chip.className = 'btn jaxtri-alert-chip';
  chip.href = 'notifications.html';
  chip.innerHTML = 'Alerts <span id="jaxtriAlertCount" class="jaxtri-alert-count">0</span>';

  const logout = document.getElementById('logout');
  if (logout && logout.parentElement === nav) nav.insertBefore(chip, logout);
  else nav.prepend(chip);
}

function installPersistentSideNav(user) {
  const sidebar = document.querySelector('.app-sidebar');
  const nav = sidebar?.querySelector('.side-nav');
  if (!sidebar || !nav) return;

  installStylesheet('assets/navigation-categories.css');

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
        ['notifications.html', 'Notifications'],
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
      ['notifications.html', 'Notifications'],
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
    installPwaShell(d.user);
    installDesktopAlertChip(d.user);
    refreshAlertBadges();

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
