// Couverture nuageuse en temps réel au-dessus du lac de la Terrasse, d'après le masque nuageux
// du satellite Meteosat (EUMETSAT, produit CLM, nouvelle image toutes les 15 min).
// On interroge 25 points dans un carré d'environ 20 km autour du lac : blanc = nuage, vert/bleu = ciel clair.
const WMS = 'https://view.eumetsat.int/geoserver/wms';
const LAT = 45.319731, LON = 5.947815, DLAT = 0.09, DLON = 0.13;
// Autres spots : ?lat=…&lon=… (zone Alpes / Léman / Lyon / Méditerranée), 9 points au lieu de 25.

async function point(lat, lon) {
  // Petite carte de 3×3 pixels centrée sur le point, on lit le pixel du milieu.
  const p = new URLSearchParams({
    service: 'WMS', version: '1.3.0', request: 'GetFeatureInfo', layers: 'msg_fes:clm', query_layers: 'msg_fes:clm',
    styles: '', crs: 'CRS:84', bbox: [lon - .01, lat - .01, lon + .01, lat + .01].join(','), width: '3', height: '3',
    i: '1', j: '1', info_format: 'application/json', feature_count: '1',
  });
  const r = await fetch(WMS + '?' + p, { cf: { cacheTtl: 300 } });
  if (!r.ok) throw new Error('EUMETSAT ' + r.status);
  const f = (await r.json()).features?.[0]?.properties;
  if (!f) return null;
  const { RED_BAND: R, GREEN_BAND: G, BLUE_BAND: B } = f;
  if (R + G + B < 30) return null;                      // pas de donnée
  return R > 180 && G > 180 && B > 180 ? 1 : 0;           // blanc = nuage
}

async function heureImage() {
  // Date de la dernière image disponible (dimension temps de la couche).
  try {
    const r = await fetch('https://view.eumetsat.int/geoserver/msg_fes/clm/ows?service=WMS&version=1.3.0&request=GetCapabilities', { cf: { cacheTtl: 300 } });
    const m = (await r.text()).match(/<Dimension[^>]*name="time"[^>]*default="([^"]+)"/);
    return m ? m[1] : null;
  } catch (e) { return null; }
}

export async function onRequestGet({ request, waitUntil }) {
  const q = new URL(request.url).searchParams;
  let lat = LAT, lon = LON, N = 5;
  if (q.has('lat') || q.has('lon')) {
    lat = Math.round(parseFloat(q.get('lat')) * 1000) / 1000; lon = Math.round(parseFloat(q.get('lon')) * 1000) / 1000;
    if (!(lat > 42 && lat < 48 && lon > 2 && lon < 9)) return new Response(JSON.stringify({ erreur: 'position hors zone' }), { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } });
    N = 3;
  }
  const cache = caches.default, key = new Request(new URL('/api/nuages' + (N === 3 ? '?lat=' + lat + '&lon=' + lon : ''), request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;
  let body, ttl = 600;
  try {
    const jobs = [];
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++)
      jobs.push(point(lat - DLAT + 2 * DLAT * a / (N - 1), lon - DLON + 2 * DLON * b / (N - 1)).catch(() => null));
    const [vals, t] = await Promise.all([Promise.all(jobs), heureImage()]);
    const ok = vals.filter(v => v !== null);
    if (ok.length < Math.ceil(N * N / 2)) throw new Error('image incomplète');
    const centre = vals[Math.floor(vals.length / 2)];
    body = { couverture: Math.round(100 * ok.reduce((s, v) => s + v, 0) / ok.length), auLac: centre, heure: t, points: ok.length, source: 'EUMETSAT Meteosat, masque nuageux (CLM)' };
  } catch (e) {
    body = { erreur: String(e.message || e) }; ttl = 120;
  }
  const res = new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=' + ttl } });
  waitUntil(cache.put(key, res.clone()));
  return res;
}
