// Photos du site servies par Cloudflare au lieu de Supabase (bande passante Supabase limitée à 5,5 Go/mois en gratuit).
// GET /img/<fichier>  →  copie de https://<projet>.supabase.co/storage/v1/object/public/photos/<fichier>
// Chaque photo n'est demandée à Supabase qu'une fois par centre Cloudflare, puis gardée en cache.
// Les noms de fichiers sont uniques (un nouvel envoi = un nouveau nom), d'où un cache long.
const SB = 'https://lhnwxbgaemphzmceieht.supabase.co/storage/v1/object/public/photos/';
const OK = /^[A-Za-z0-9._\-\/]{1,200}$/;

export async function onRequestGet(context) {
  const { request, params } = context;
  const path = [].concat(params.path || []).join('/');
  if (!OK.test(path) || path.includes('..')) return new Response('Not found', { status: 404 });
  const cache = caches.default;
  const key = new Request(new URL(request.url).origin + '/img/' + path);
  let res = await cache.match(key);
  if (res) return res;
  const up = await fetch(SB + path, { cf: { cacheTtl: 31536000, cacheEverything: true } });
  if (!up.ok) return new Response('Not found', { status: up.status === 404 || up.status === 400 ? 404 : 502, headers: { 'Cache-Control': 'no-store' } });
  res = new Response(up.body, { status: 200 });
  res.headers.set('Content-Type', up.headers.get('content-type') || 'image/webp');
  res.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.headers.set('Access-Control-Allow-Origin', '*');
  context.waitUntil(cache.put(key, res.clone()));
  return res;
}
