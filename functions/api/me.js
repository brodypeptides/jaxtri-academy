import { json, getUserFromRequest } from '../lib/auth.js';
export async function onRequestGet({request,env}){const user=await getUserFromRequest(env,request);if(!user)return json({error:'Not logged in'},401);return json({user})}
