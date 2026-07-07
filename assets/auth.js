(function(){
  const KEY = 'jaxtriAcademySession';
  function setCookie(name, value, days){
    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
  }
  function getCookie(name){
    return document.cookie.split('; ').find(row => row.startsWith(name + '='))?.split('=')[1];
  }
  function readSession(){
    try { return JSON.parse(localStorage.getItem(KEY) || decodeURIComponent(getCookie(KEY) || 'null')); }
    catch(e){ return null; }
  }
  function saveSession(role, email){
    const session = { role, email: email || '', savedAt: Date.now() };
    const value = JSON.stringify(session);
    localStorage.setItem(KEY, value);
    setCookie(KEY, value, 14);
    return session;
  }
  function clearSession(){
    localStorage.removeItem(KEY);
    document.cookie = KEY + '=; max-age=0; path=/; SameSite=Lax';
  }
  function isAllowed(session, needed){
    if(!session) return false;
    if(needed === 'owner') return session.role === 'owner';
    if(needed === 'affiliate') return session.role === 'affiliate' || session.role === 'owner';
    return true;
  }
  window.JaxtriAuth = { readSession, saveSession, clearSession };
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
        const email = loginForm.querySelector('input[type="email"], input[name="email"]')?.value || '';
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
        const email = signupForm.querySelector('input[type="email"], input[name="email"]')?.value || '';
        saveSession('affiliate', email);
        window.location.href = 'affiliate-dashboard.html';
      });
    }
  });
})();
