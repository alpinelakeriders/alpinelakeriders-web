import { json, admin, configured, token } from '../../../lib/ig.js';
// État de la connexion Instagram (sans jamais renvoyer le jeton)
export async function onRequestGet({ request, env }) {
  const jwt = await admin(request);
  if (!jwt) return json({ error: 'réservé aux administrateurs' }, 401);
  const out = { configured: configured(env), connected: false };
  try {
    const c = await token(jwt);
    if (c) Object.assign(out, { connected: !c.expired, expired: !!c.expired, username: c.username, expire: c.expire });
  } catch (e) { out.dbError = String(e.message || e); }
  return json(out);
}
