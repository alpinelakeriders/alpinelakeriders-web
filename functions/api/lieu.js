// Trouve la position d'un lien Google Maps collé dans « Modifier la position » (carte des spots).
// Les liens courts (maps.app.goo.gl) sont suivis côté serveur, ce que le navigateur ne peut pas faire.
// GET /api/lieu?url=<lien Google Maps>  →  { lat, lon, nom }
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

export async function onRequestGet({ request }) {
  let url = new URL(request.url).searchParams.get('url') || '';
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
