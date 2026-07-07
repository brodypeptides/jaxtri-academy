import { json, getCookie } from '../lib/auth.js';
export async function onRequestPost({request,env}){const sid=getCookie(request,'jaxtri_session');if(sid)await env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(sid).run();return json({ok:true},200,{'set-cookie':'jaxtri_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'})}
