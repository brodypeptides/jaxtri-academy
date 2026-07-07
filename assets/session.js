function dashboardFor(user) {
  if (!user) return '/login.html';
  if (user.status === 'pending') return '/pending.html';
  if (user.role === 'owner' || user.role === 'manager') return '/owner-dashboard.html';
  return '/academy-dashboard.html';
}

function privatePageAllowed(user) {
  const path = location.pathname.split('/').pop() || 'index.html';
  if (!user) return false;
  if (user.status === 'suspended') return false;
  if (user.status === 'pending') return path === 'pending.html';

  if (path === 'pending.html') return false;
  if (path === 'owner-users.html') return user.role === 'owner';
  if (path.startsWith('owner-')) return user.role === 'owner' || user.role === 'manager';
  return true;
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
