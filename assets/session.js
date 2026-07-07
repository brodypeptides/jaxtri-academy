async function loadSession(){
  const target=document.getElementById('me');
  try{const r=await fetch('/api/me'); const d=await r.json();
    if(!r.ok){location.href='/login.html';return}
    if(target) target.textContent=`Logged in as ${d.user.full_name} — ${d.user.role}${d.user.company_title?` (${d.user.company_title})`:''}`;
  }catch(e){ if(target) target.textContent='Could not load session.' }
}
async function logout(){await fetch('/api/logout',{method:'POST'});location.href='/login.html'}
document.getElementById('logout')?.addEventListener('click',logout);loadSession();
