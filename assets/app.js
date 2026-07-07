const API='/api';
function $(s){return document.querySelector(s)}
function getSession(){try{return JSON.parse(localStorage.getItem('jaxtri_session')||'null')}catch{return null}}
function setSession(user){localStorage.setItem('jaxtri_session',JSON.stringify(user));document.cookie='jaxtri_session=preview; max-age=2592000; path=/'}
function logout(){localStorage.removeItem('jaxtri_session');document.cookie='jaxtri_session=; max-age=0; path=/'; location.href='../affiliate-login.html'}
function requireRole(role){const s=getSession(); if(!s||s.role!==role){location.href=role==='owner'?'../owner-login.html':'../affiliate-login.html'}}
function demoLogin(role){setSession({role,email:role==='owner'?'owner@jaxtri.local':'affiliate@jaxtri.local',name:role==='owner'?'Jaxtri Owner':'Demo Affiliate'}); location.href=role==='owner'?'admin/index.html':'app/index.html'}
async function api(path,opts={}){const r=await fetch(API+path,{headers:{'content-type':'application/json'},...opts});return r.json()}
async function submitApplication(e){e.preventDefault(); const data=Object.fromEntries(new FormData(e.target).entries()); try{await api('/applications',{method:'POST',body:JSON.stringify(data)})}catch{} localStorage.setItem('jaxtri_application',JSON.stringify(data)); location.href='pending.html'}
async function createContent(e){e.preventDefault(); const data=Object.fromEntries(new FormData(e.target).entries()); const items=JSON.parse(localStorage.getItem('jaxtri_content')||'[]'); items.unshift({...data,createdAt:new Date().toISOString()}); localStorage.setItem('jaxtri_content',JSON.stringify(items)); alert('Saved locally for preview. Cloudflare D1 publishing comes next.'); e.target.reset(); renderLocalContent()}
function renderLocalContent(){const el=$('#local-content'); if(!el)return; const items=JSON.parse(localStorage.getItem('jaxtri_content')||'[]'); el.innerHTML=items.length?items.map(i=>`<article class="feed-post"><span class="tag draft">${i.type||'Content'}</span><h3>${i.title||'Untitled'}</h3><p>${i.body||''}</p></article>`).join(''):'<p class="small">No local content yet.</p>'}
window.Jaxtri={demoLogin,logout,requireRole,submitApplication,createContent,renderLocalContent};
document.addEventListener('DOMContentLoaded',()=>{renderLocalContent(); const s=getSession(); document.querySelectorAll('[data-user-name]').forEach(el=>el.textContent=s?.name||'Affiliate')})
