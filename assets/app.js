(function(){
  const demoUsers={
    owner:{email:'owner@jaxtri.local',role:'owner',name:'Owner Demo',status:'approved'},
    manager:{email:'manager@jaxtri.local',role:'manager',name:'Manager Demo',status:'approved'},
    affiliate:{email:'affiliate@jaxtri.local',role:'affiliate',name:'Affiliate Demo',status:'approved'},
    pending:{email:'pending@jaxtri.local',role:'affiliate',name:'Pending Demo',status:'pending'}
  };
  function setSession(user){localStorage.setItem('jaxtri_session',JSON.stringify({...user,loginAt:new Date().toISOString()}));}
  function getSession(){try{return JSON.parse(localStorage.getItem('jaxtri_session')||'null')}catch(e){return null}}
  function logout(){localStorage.removeItem('jaxtri_session');location.href='login.html'}
  window.Jaxtri={setSession,getSession,logout};
  document.addEventListener('click',e=>{const btn=e.target.closest('[data-demo-login]');if(!btn)return;const user=demoUsers[btn.dataset.demoLogin];setSession(user);if(user.status==='pending') location.href='pending.html'; else if(user.role==='owner'||user.role==='manager') location.href='owner-dashboard.html'; else location.href='academy-dashboard.html';});
  document.addEventListener('click',e=>{if(e.target.closest('[data-logout]'))logout();});
  document.addEventListener('submit',e=>{const form=e.target;if(form.matches('[data-login-form]')){e.preventDefault();const email=(form.querySelector('[name=email]')?.value||'').toLowerCase();let user= email.includes('owner')?demoUsers.owner:email.includes('manager')?demoUsers.manager:email.includes('pending')?demoUsers.pending:demoUsers.affiliate;setSession(user);if(user.status==='pending') location.href='pending.html'; else if(user.role==='owner'||user.role==='manager') location.href='owner-dashboard.html'; else location.href='academy-dashboard.html';} if(form.matches('[data-apply-form]')){e.preventDefault();location.href='pending.html';} if(form.matches('[data-submit-content-form]')){e.preventDefault();alert('Static preview: this submission would be saved as Pending Review in Cloudflare D1.');}});
  document.addEventListener('DOMContentLoaded',()=>{const session=getSession();document.querySelectorAll('[data-user-name]').forEach(el=>el.textContent=session?.name||'Demo User');document.querySelectorAll('[data-user-role]').forEach(el=>el.textContent=session?.role||'visitor');const protectedPage=document.body.dataset.protected;if(protectedPage&&!session){location.href='login.html'} if(protectedPage==='owner'&&session&&!(session.role==='owner'||session.role==='manager')){location.href='academy-dashboard.html'} if(protectedPage==='affiliate'&&session&&session.status==='pending'){location.href='pending.html'} });
})();
