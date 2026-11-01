// Trouve la position d'un lien Google Maps collé dans « Modifier la position » (carte des spots).
// Les liens courts (maps.app.goo.gl) sont suivis côté serveur, ce que le navigateur ne peut pas faire.
// GET /api/lieu?url=<lien Google Maps>  →  { lat, lon, nom }
// GET /api/lieu?q=<texte>&lat=&lon=     →  { lieux:[{nom,adresse,lat,lon}] } via Google Places (réservé aux admins connectés,
//   nécessite la variable GOOGLE_PLACES_KEY dans Cloudflare Pages ; sans elle : { nokey:true }).
const SB = 'https://lhnwxbgaemphzmceieht.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxobnd4YmdhZW1waHptY2VpZWh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMzc1MDksImV4cCI6MjEwODYxMzUwOX0.uxcxlf3eJAKxi3z3NxVeY5P5ipqO3yvTk--WvkrrrYE'; // clé publique, déjà dans js/config.js

async function isAdmin(request) {
  const tok = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!tok) return false;
  try {
    const r = await fetch(SB + '/rest/v1/rpc/is_admin', { method: 'POST', headers: { apikey: ANON, authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: '{}' });
    return r.ok && (await r.json()) === true;
  } catch (e) { return false; }
}

async function google(env, q, lat, lon) {
  const body = { textQuery: q, languageCode: 'fr', maxResultCount: 6 };
  if (isFinite(lat) && isFinite(lon)) body.locationBias = { circle: { center: { latitude: lat, longitude: lon }, radius: 50000 } };
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': env.GOOGLE_PLACES_KEY, 'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location' },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) return { erreur: (d.error && d.error.message) || 'Google ' + r.status };
  return { lieux: (d.places || []).map(p => ({ nom: p.displayName?.text || '', adresse: p.formattedAddress || '', lat: p.location.latitude, lon: p.location.longitude })) };
}
const OK = /^(https?:\/\/)?((www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i;
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

function coords(u) {
  const t = decodeURIComponent(u);
  let m = t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);           // position exacte du lieu
  if (!m) m = t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);           // centre de la carte
  if (!m) m = t.match(/[?&](?:q|query|ll|center|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (!m) return null;
  const lat = +m[1], lon = +m[2];
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return null;
  const n = t.match(/\/place\/([^/@]+)/);
  return { lat, lon, nom: n ? n[1].replace(/\+/g, ' ') : '' };
}

export async function onRequestGet({ request, env }) {
  const sp = new URL(request.url).searchParams;
  if (sp.has('q')) {
    const q = (sp.get('q') || '').trim().slice(0, 200);
    if (!q) return json({ lieux: [] });
    if (!env.GOOGLE_PLACES_KEY) return json({ nokey: true });
    if (!(await isAdmin(request))) return json({ erreur: 'réservé aux administrateurs' }, 403);
    try { return json(await google(env, q, parseFloat(sp.get('lat')), parseFloat(sp.get('lon')))); }
    catch (e) { return json({ erreur: String(e.message || e) }, 502); }
  }
  let url = sp.get('url') || '';
  url = url.trim();
  if (!OK.test(url)) return json({ erreur: 'lien Google Maps attendu' }, 400);
  if (!/^https?:/i.test(url)) url = 'https://' + url;
  let c = coords(url);
  for (let i = 0; !c && i < 6; i++) {
    const r = await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'accept-language': 'fr' } });
    const loc = r.headers.get('location');
    if (loc) { url = new URL(loc, url).toString(); c = coords(url); continue; }
    // Page finale : chercher la position dans le HTML
    const html = (await r.text()).slice(0, 400000);
    c = coords(html.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&'));
    if (!c) { const m = html.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/); if (m) c = { lat: +m[1], lon: +m[2], nom: '' }; }
    break;
  }
  return c ? json(c) : json({ erreur: 'position introuvable dans ce lien' }, 404);
}
