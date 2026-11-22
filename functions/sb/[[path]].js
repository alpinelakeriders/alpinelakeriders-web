// Relais en cache vers Supabase : /sb/rest/v1/...  et  /sb/storage/v1/object/public/...
// Les visiteurs (alpinelakeriders.com et les pages météo d'alpinefoil.com) lisent ici au lieu
// de Supabase : Cloudflare garde la réponse quelques minutes et la sert à tout le monde,
// ce qui ramène la bande passante Supabase à presque rien. Les écritures passent sans cache.
const SB = 'https://lhnwxbgaemphzmceieht.supabase.co';

// Fonctions en lecture seule dont la réponse peut être partagée entre visiteurs (POST mis en cache)
const READ_RPC = new Set([
  'lake_level_summary', 'lake_level_series', 'meteo_lake_levels', 'lake_level_now',
  'lakemetric_station_levels', 'lakemetric_quality_now', 'nb_membres', 'avis_publics',
]);
// Chemins accessibles via le relais (rien d'autre : ni connexion, ni temps réel, ni administration)
const ALLOWED = /^\/(rest\/v1\/|storage\/v1\/object\/public\/)/;
const DATED = /\d{4}-\d{2}-\d{2}[_T-]?\d{0,4}|[a-z0-9]{8}-[a-z0-9]{6}\.webp$/i; // fichiers horodatés ou à nom unique : ne changent jamais

function ttl(path, method) {
  if (path.startsWith('/storage/')) return DATED.test(path) ? 7 * 86400 : 300;
  if (method === 'POST') return 300;          // niveaux, séries, compteurs
  return 90;                                  // listes webcams, températures (mises à jour toutes les 5 min au plus)
}

function cors(h, origin) {
  h.set('access-control-allow-origin', origin || '*');
  h.set('vary', 'origin');
  h.set('access-control-expose-headers', 'content-range, x-cache');
  return h;
}

async function sha(text) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export async function onRequest({ request, waitUntil }) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/sb/, '');
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors(new Headers({
      'access-control-allow-methods': 'GET, POST, HEAD, OPTIONS',
      'access-control-allow-headers': request.headers.get('access-control-request-headers') || 'apikey, authorization, content-type, accept, prefer, range',
      'access-control-max-age': '86400',
    }), origin) });
  }
  if (!ALLOWED.test(path)) return new Response('Not found', { status: 404 });

  const target = SB + path + url.search;
  const fwd = new Headers();
  for (const k of ['apikey', 'authorization', 'content-type', 'accept', 'prefer', 'range', 'accept-profile', 'content-profile']) {
    const v = request.headers.get(k); if (v) fwd.set(k, v);
  }
  const rpc = path.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
  const cacheable = request.method === 'GET' || request.method === 'HEAD' || (request.method === 'POST' && rpc && READ_RPC.has(rpc[1]));
  // Une requête connectée (jeton d'un membre) n'est jamais partagée entre visiteurs
  const anon = !fwd.get('authorization') || fwd.get('authorization').replace(/^Bearer\s+/i, '') === fwd.get('apikey');
  const body = request.method === 'POST' ? await request.text() : undefined;

  if (!cacheable || !anon) {
    const r = await fetch(target, { method: request.method, headers: fwd, body });
    const h = cors(new Headers(r.headers), origin); h.set('x-cache', 'BYPASS'); h.set('cache-control', 'no-store');
    return new Response(r.body, { status: r.status, headers: h });
  }

  const extra = [fwd.get('accept'), fwd.get('prefer'), fwd.get('range'), fwd.get('accept-profile'), body].join('|');
  const key = new Request(url.origin + '/__cache' + path + (url.search ? url.search + '&' : '?') + '__k=' + (await sha(extra)), { method: 'GET' });
  const cache = caches.default;
  let hit = await cache.match(key);
  if (hit) { const h = cors(new Headers(hit.headers), origin); h.set('x-cache', 'HIT'); return new Response(request.method === 'HEAD' ? null : hit.body, { status: hit.status, headers: h }); }

  const r = await fetch(target, { method: request.method === 'HEAD' ? 'GET' : request.method, headers: fwd, body });
  const t = ttl(path, request.method);
  const h = new Headers(r.headers);
  ['set-cookie', 'access-control-allow-origin', 'vary'].forEach(k => h.delete(k));
  h.set('cache-control', r.status === 200 ? 'public, max-age=' + Math.min(t, 300) + ', s-maxage=' + t : 'no-store');
  if (r.status === 200) {
    const stored = new Response(r.clone().body, { status: r.status, headers: h });
    waitUntil(cache.put(key, stored));
  }
  const out = cors(new Headers(h), origin); out.set('x-cache', 'MISS');
  return new Response(request.method === 'HEAD' ? null : r.body, { status: r.status, headers: out });
}
