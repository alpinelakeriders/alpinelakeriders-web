// Outils partagés des fonctions Instagram (functions/api/ig/*).
// Secrets attendus dans Cloudflare Pages (Réglages > Variables et secrets) : IG_APP_ID et IG_APP_SECRET.
// Le jeton Instagram est stocké dans Supabase (table fermée ig_connexion), lu et écrit avec la session de l'admin.
export const SB = 'https://lhnwxbgaemphzmceieht.supabase.co';
export const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxobnd4YmdhZW1waHptY2VpZWh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMzc1MDksImV4cCI6MjEwODYxMzUwOX0.uxcxlf3eJAKxi3z3NxVeY5P5ipqO3yvTk--WvkrrrYE'; // clé « anon » publique
export const GRAPH = 'https://graph.instagram.com/v26.0';

export const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export const redirectUri = url => url.origin + '/ig-callback';
export const configured = env => !!(env.IG_APP_ID && env.IG_APP_SECRET);

// Appel d'une fonction Supabase avec la session de l'admin
export async function rpc(jwt, name, args) {
  const r = await fetch(SB + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify(args || {}),
  });
  const t = await r.text();
  let d = null; try { d = t ? JSON.parse(t) : null; } catch (e) {}
  if (!r.ok) { const e = new Error((d && (d.message || d.hint)) || ('supabase ' + r.status)); e.status = r.status; throw e; }
  return d;
}

// Vérifie que la requête vient d'un administrateur connecté ; renvoie son jeton de session
export async function admin(request) {
  const h = request.headers.get('authorization') || '';
  const jwt = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!jwt) return null;
  try { return (await rpc(jwt, 'is_admin')) === true ? jwt : null; } catch (e) { return null; }
}

export async function igGet(path, params) {
  const u = new URL(path.startsWith('http') ? path : GRAPH + path);
  Object.entries(params || {}).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u.toString());
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw igErr(d);
  return d;
}
export async function igPost(path, params) {
  const r = await fetch(path.startsWith('http') ? path : GRAPH + path, { method: 'POST', body: new URLSearchParams(params) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw igErr(d);
  return d;
}
function igErr(d) {
  const e = d && d.error;
  const m = (e && (e.error_user_msg || e.message)) || (d && (d.error_message || d.error_description)) || 'erreur Instagram';
  const x = new Error(String(m)); x.ig = true; x.code = e && e.code; return x;
}

// Jeton enregistré ; prolongé de 60 jours s'il a plus de 7 jours (Instagram l'accepte après 24 h)
export async function token(jwt) {
  const rows = await rpc(jwt, 'ig_jeton_get');
  const c = rows && rows[0];
  if (!c) return null;
  const exp = c.expire ? Date.parse(c.expire) : 0;
  if (exp && exp < Date.now()) return Object.assign(c, { expired: true });
  if (Date.now() - Date.parse(c.maj) > 7 * 864e5) {
    try {
      const d = await igGet('https://graph.instagram.com/refresh_access_token', { grant_type: 'ig_refresh_token', access_token: c.token });
      const expire = new Date(Date.now() + (d.expires_in || 5184000) * 1000).toISOString();
      await rpc(jwt, 'ig_jeton_set', { p_token: d.access_token, p_user: null, p_username: null, p_expire: expire });
      c.token = d.access_token; c.expire = expire;
    } catch (e) { /* on garde l'ancien jeton s'il est encore valable */ }
  }
  return c;
}
