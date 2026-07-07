
(function(){
  const SESSION_KEY = 'jaxtriAcademySession';
  const REQUESTS_KEY = 'jaxtriAcademyAccessRequests';
  const APPROVED_KEY = 'jaxtriAcademyApprovedEmails';
  function setCookie(name, value, days){
    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
  }
  function getCookie(name){
    return document.cookie.split('; ').find(row => row.startsWith(name + '='))?.split('=')[1];
  }
  function readSession(){
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || decodeURIComponent(getCookie(SESSION_KEY) || 'null')); }
    catch(e){ return null; }
  }
  function saveSession(role, email){
    const session = { role, email: (email || '').toLowerCase(), savedAt: Date.now() };
    const value = JSON.stringify(session);
    localStorage.setItem(SESSION_KEY, value);
    setCookie(SESSION_KEY, value, 14);
    return session;
  }
  function clearSession(){
    localStorage.removeItem(SESSION_KEY);
    document.cookie = SESSION_KEY + '=; max-age=0; path=/; SameSite=Lax';
  }
  function list(key){
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch(e){ return []; }
  }
  function saveList(key, items){ localStorage.setItem(key, JSON.stringify(items)); }
  function getRequests(){ return list(REQUESTS_KEY); }
  function saveRequest(request){
    const requests = getRequests();
    const email = (request.email || '').toLowerCase();
    const existing = requests.findIndex(r => (r.email || '').toLowerCase() === email);
    const next = { ...request, email, status: 'pending', createdAt: new Date().toISOString() };
    if(existing >= 0) requests[existing] = next; else requests.unshift(next);
    saveList(REQUESTS_KEY, requests);
  }
  function getApproved(){ return list(APPROVED_KEY).map(e => String(e).toLowerCase()); }
  function isApproved(email){ return getApproved().includes(String(email || '').toLowerCase()); }
  function approveEmail(email){
    const normalized = String(email || '').toLowerCase();
    const approved = getApproved();
    if(normalized && !approved.includes(normalized)) approved.push(normalized);
    saveList(APPROVED_KEY, approved);
    const requests = getRequests().map(r => (r.email || '').toLowerCase() === normalized ? {...r, status:'approved'} : r);
    saveList(REQUESTS_KEY, requests);
  }
  function rejectEmail(email){
    const normalized = String(email || '').toLowerCase();
    const requests = getRequests().map(r => (r.email || '').toLowerCase() === normalized ? {...r, status:'rejected'} : r);
    saveList(REQUESTS_KEY, requests);
  }
  function isAllowed(session, needed){
    if(!session) return false;
    if(needed === 'owner') return session.role === 'owner';
    if(needed === 'affiliate') return session.role === 'affiliate' || session.role === 'owner';
    return true;
  }
  window.JaxtriAuth = { readSession, saveSession, clearSession, saveRequest, getRequests, approveEmail, rejectEmail, isApproved };
  document.addEventListener('DOMContentLoaded', function(){
    const protectedRole = document.body.dataset.protected;
    const session = readSession();
    if(protectedRole && !isAllowed(session, protectedRole)){
      const target = protectedRole === 'owner' ? 'owner-login.html' : 'affiliate-login.html';
      window.location.href = target + '?next=' + encodeURIComponent(location.pathname.split('/').pop() || 'index.html');
      return;
    }
    document.querySelectorAll('[data-logout]').forEach(btn => btn.addEventListener('click', function(e){
      e.preventDefault(); clearSession(); window.location.href = 'index.html';
    }));
    const loginForm = document.querySelector('[data-login-form]');
    if(loginForm){
      const role = loginForm.dataset.role || 'affiliate';
      loginForm.addEventListener('submit', function(e){
        e.preventDefault();
        const email = (loginForm.querySelector('input[type="email"], input[name="email"]')?.value || '').toLowerCase();
        const error = document.querySelector('[data-login-error]');
        if(role === 'affiliate' && !isApproved(email)){
          if(error) error.textContent = 'This Academy account is not approved yet. Please wait for owner approval in Discord.';
          return;
        }
        saveSession(role, email);
        const params = new URLSearchParams(location.search);
        const next = params.get('next');
        window.location.href = next || (role === 'owner' ? 'owner-dashboard.html' : 'affiliate-dashboard.html');
      });
    }
    const signupForm = document.querySelector('[data-signup-form]');
    if(signupForm){
      signupForm.addEventListener('submit', function(e){
        e.preventDefault();
        const data = new FormData(signupForm);
        const request = Object.fromEntries(data.entries());
        saveRequest(request);
        window.location.href = 'pending-approval.html';
      });
    }
    const approvalList = document.querySelector('[data-approval-list]');
    if(approvalList){
      const render = () => {
        const requests = getRequests();
        if(!requests.length){ approvalList.innerHTML = '<div class="note"><strong>No access requests yet.</strong><p>When affiliates request Academy access, they will appear here for approval.</p></div>'; return; }
        approvalList.innerHTML = requests.map((r,i)=>`<article class="feed-post"><div class="post-top"><div class="avatar">${(r.name||r.email||'?').slice(0,1).toUpperCase()}</div><div class="post-meta"><strong>${r.name||'Unnamed affiliate'}</strong><span>${r.email||''} · ${r.discord||'No Discord listed'}</span></div></div><p>${r.reason||'No note provided.'}</p><div class="tag-row"><span class="tag ${r.status==='approved'?'approved':r.status==='rejected'?'archived':'testing'}">${r.status||'pending'}</span><span class="tag">${r.platform||'Already affiliate check'}</span></div><div class="hero-actions"><button class="button primary" data-approve="${r.email}">Approve Access</button><button class="button secondary" data-reject="${r.email}">Reject</button></div></article>`).join('');
        approvalList.querySelectorAll('[data-approve]').forEach(b=>b.addEventListener('click',()=>{ approveEmail(b.dataset.approve); render(); }));
        approvalList.querySelectorAll('[data-reject]').forEach(b=>b.addEventListener('click',()=>{ rejectEmail(b.dataset.reject); render(); }));
      };
      render();
    }
  });
})();
