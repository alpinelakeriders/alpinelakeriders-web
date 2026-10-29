import { json, admin, configured, redirectUri } from '../../../lib/ig.js';
// Adresse de connexion Instagram (le navigateur de l'admin y est envoyé)
export async function onRequestPost({ request, env }) {
  if (!(await admin(request))) return json({ error: 'réservé aux administrateurs' }, 401);
  if (!configured(env)) return json({ error: 'IG_APP_ID et IG_APP_SECRET ne sont pas encore réglés dans Cloudflare.' }, 400);
  const { state } = await request.json().catch(() => ({}));
  const u = new URL('https://www.instagram.com/oauth/authorize');
  u.searchParams.set('client_id', env.IG_APP_ID);
  u.searchParams.set('redirect_uri', redirectUri(new URL(request.url)));
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'instagram_business_basic,instagram_business_content_publish');
  u.searchParams.set('enable_fb_login', 'false');
  if (state) u.searchParams.set('state', String(state).slice(0, 64));
  return json({ url: u.toString() });
}
