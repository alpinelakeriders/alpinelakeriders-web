// 1. Redirige www.alpinelakeriders.com vers alpinelakeriders.com
// 2. Écrit dans la page les textes saisis dans l'admin (Supabase), pour que
//    WhatsApp, Facebook et Google voient les textes à jour (ils n'exécutent pas le JavaScript du site).
const SB = 'https://lhnwxbgaemphzmceieht.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxobnd4YmdhZW1waHptY2VpZWh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMzc1MDksImV4cCI6MjEwODYxMzUwOX0.uxcxlf3eJAKxi3z3NxVeY5P5ipqO3yvTk--WvkrrrYE'; // clé « anon » publique, déjà dans js/config.js
const SKIP = new Set(['inscrits']); // calculé par le site lui-même

const BOTS = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|headless|lighthouse|curl|wget|python|monitor|uptime/i;

function logVisite(request, url) {
  const ua = request.headers.get('user-agent') || '';
  if (!ua || BOTS.test(ua)) return null;
  if (url.hostname !== 'alpinelakeriders.com') return null;
  const purpose = request.headers.get('sec-purpose') || request.headers.get('purpose') || '';
  if (/prefetch|prerender/i.test(purpose)) return null;
  const appareil = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua) ? 'tablette' : /Mobi|iPhone|Android/i.test(ua) ? 'mobile' : 'ordinateur';
  let source = '';
  try { const r = new URL(request.headers.get('referer') || ''); if (!r.hostname.endsWith('alpinelakeriders.com')) source = r.hostname.replace(/^www\./, ''); } catch (e) {}
  const body = { p_pays: request.headers.get('cf-ipcountry') || '', p_appareil: appareil, p_source: source, p_sortie: url.searchParams.get('sortie') || '' };
  return fetch(SB + '/rest/v1/rpc/log_visite', {
    method: 'POST',
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  if (url.hostname.startsWith('www.')) {
    url.hostname = url.hostname.slice(4);
    return Response.redirect(url.toString(), 301);
  }
  const res = await next();
  if (request.method !== 'GET' || !(res.headers.get('content-type') || '').includes('text/html')) return res;
  try { const p = logVisite(request, url); if (p) context.waitUntil(p); } catch (e) {}
  const sid = (url.searchParams.get('sortie') || '').slice(0, 80);
  let c = null, so = null;
  if (/^[\w-]+$/.test(sid)) {
    try {
      const r = await fetch(SB + '/rest/v1/docs?collection=eq.sorties&id=eq.' + encodeURIComponent(sid) + '&select=data', {
        headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
        cf: { cacheTtl: 60, cacheEverything: true },
      });
      if (r.ok) { const j = await r.json(); so = j && j[0] && j[0].data; }
    } catch (e) {}
  }
  try {
    const r = await fetch(SB + '/rest/v1/docs?collection=eq.contenu&id=eq.site&select=data', {
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
      cf: { cacheTtl: 60, cacheEverything: true },
    });
    if (r.ok) { const j = await r.json(); c = j && j[0] && j[0].data; }
  } catch (e) { /* en cas de souci, on sert la page telle quelle */ }
  if ((!c || typeof c !== 'object') && !so) return res;
  c = (c && typeof c === 'object') ? c : {};
  try {
    const txt = k => (typeof c[k] === 'string' && c[k].trim()) ? c[k].trim() : '';
    const share = txt('partage') || [txt('slogan'), txt('accroche')].filter(Boolean).join(' ');
    const setContent = v => ({ element(e) { e.setAttribute('content', v); } });
    let rw = new HTMLRewriter();
    if (so && typeof so === 'object') {
      const MOIS = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
      const JOURS = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
      const d = new Date((so.date || '') + 'T12:00:00Z');
      const quand = isNaN(d) ? '' : JOURS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MOIS[d.getUTCMonth()];
      const title = (so.titre || 'Sortie') + (quand ? ' · ' + quand : '');
      const desc = [[so.heure, so.lieu].filter(Boolean).join(' · '), 'Inscris-toi sur le site d\'Alpine Lake Riders.'].filter(Boolean).join('. ');
      const u = 'https://alpinelakeriders.com/?sortie=' + encodeURIComponent(sid);
      rw = rw.on('meta[property="og:title"]', setContent(title))
             .on('meta[name="twitter:title"]', setContent(title))
             .on('meta[property="og:description"]', setContent(desc))
             .on('meta[name="twitter:description"]', setContent(desc))
             .on('meta[property="og:url"]', setContent(u));
    } else if (share) {
      rw = rw.on('meta[property="og:description"]', setContent(share))
             .on('meta[name="twitter:description"]', setContent(share));
    }
    if (txt('partage')) rw = rw.on('meta[name="description"]', setContent(txt('partage')));
    rw = rw.on('[data-k]', { element(e) {
      const k = e.getAttribute('data-k');
      if (!SKIP.has(k) && txt(k)) e.setInnerContent(txt(k));
    } });
    return rw.transform(res);
  } catch (e) {
    return res;
  }
}
