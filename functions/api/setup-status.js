import { json } from '../lib/auth.js';
export async function onRequestGet({env}){const owner=await env.DB.prepare("SELECT id FROM users WHERE role='owner' LIMIT 1").first();return json({initialized:!!owner})}
