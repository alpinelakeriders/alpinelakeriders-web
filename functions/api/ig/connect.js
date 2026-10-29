import { json, admin, configured, redirectUri, rpc, igGet } from '../../../lib/ig.js';
// Échange le code contre un jeton longue durée (60 jours) et l'enregistre. Le jeton ne passe jamais par le navigateur.
export async function onRequestPost({ request, env }) {
  const jwt = await admin(request);
  if (!jwt) return json({ error: 'réservé aux administrateurs' }, 401);
  if (!configured(env)) return json({ error: 'IG_APP_ID et IG_APP_SECRET ne sont pas encore réglés dans Cloudflare.' }, 400);
  const { code } = await request.json().catch(() => ({}));
  if (!code) return json({ error: 'code manquant' }, 400);
  try {
    const r = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: new URLSearchParams({ client_id: env.IG_APP_ID, client_secret: env.IG_APP_SECRET, grant_type: 'authorization_code', redirect_uri: redirectUri(new URL(request.url)), code }),
    });
    const d = await r.json().catch(() => ({}));
    const short = d.access_token || (d.data && d.data[0] && d.data[0].access_token);
    if (!short) return json({ error: d.error_message || (d.error && d.error.message) || 'échange du code refusé' }, 400);
    const long = await igGet('https://graph.instagram.com/access_token', { grant_type: 'ig_exchange_token', client_secret: env.IG_APP_SECRET, access_token: short });
    const me = await igGet('/me', { fields: 'user_id,username,account_type', access_token: long.access_token });
    const expire = new Date(Date.now() + (long.expires_in || 5184000) * 1000).toISOString();
    await rpc(jwt, 'ig_jeton_set', { p_token: long.access_token, p_user: String(me.user_id || me.id || ''), p_username: me.username || '', p_expire: expire });
    return json({ ok: true, username: me.username, accountType: me.account_type, expire });
  } catch (e) {
    return json({ error: String(e.message || e) }, 400);
  }
}
