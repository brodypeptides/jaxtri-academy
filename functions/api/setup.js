import { json, hashPassword, createSession, cookie } from '../lib/auth.js';
export async function onRequestPost({request,env}){
  const existing=await env.DB.prepare("SELECT id FROM users WHERE role='owner' LIMIT 1").first();
  if(existing)return json({error:'This Academy is already initialized.'},403);
  const body=await request.json().catch(()=>null);
  if(!body)return json({error:'Invalid request.'},400);
  const {full_name,email,username,password,company_title}=body;
  if(!full_name||!email||!username||!password)return json({error:'Missing required fields.'},400);
  if(password.length<8)return json({error:'Password must be at least 8 characters.'},400);
  const pw=await hashPassword(password);
  try{
    const result=await env.DB.prepare(`INSERT INTO users (full_name,email,username,password_hash,role,company_title,status) VALUES (?,?,?,?,?,?, 'active')`).bind(full_name,email.toLowerCase(),username.toLowerCase(),pw,'owner',company_title||'Manager, Jaxtri Labs').run();
    const session=await createSession(env,result.meta.last_row_id,true);
    return json({ok:true,redirect:'/owner-dashboard.html'},200,{'set-cookie':cookie('jaxtri_session',session.id,session.maxAge)});
  }catch(e){return json({error:'Could not create owner. Email/username may already exist.'},400)}
}
