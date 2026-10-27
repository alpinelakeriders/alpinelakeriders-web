// 1. Redirige www.alpinelakeriders.com vers alpinelakeriders.com
// 2. Écrit dans la page les textes saisis dans l'admin (Supabase), pour que
//    WhatsApp, Facebook et Google voient les textes à jour (ils n'exécutent pas le JavaScript du site).
const SB = 'https://lhnwxbgaemphzmceieht.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxobnd4YmdhZW1waHptY2VpZWh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMzc1MDksImV4cCI6MjEwODYxMzUwOX0.uxcxlf3eJAKxi3z3NxVeY5P5ipqO3yvTk--WvkrrrYE'; // clé « anon » publique, déjà dans js/config.js
const SKIP = new Set(['inscrits']); // calculé par le site lui-même

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  if (url.hostname.startsWith('www.')) {
    url.hostname = url.hostname.slice(4);
    return Response.redirect(url.toString(), 301);
  }
  const res = await next();
  if (request.method !== 'GET' || !(res.headers.get('content-type') || '').includes('text/html')) return res;
  let c = null;
  try {
    const r = await fetch(SB + '/rest/v1/docs?collection=eq.contenu&id=eq.site&select=data', {
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
      cf: { cacheTtl: 60, cacheEverything: true },
    });
    if (r.ok) { const j = await r.json(); c = j && j[0] && j[0].data; }
  } catch (e) { /* en cas de souci, on sert la page telle quelle */ }
  if (!c || typeof c !== 'object') return res;
  try {
    const txt = k => (typeof c[k] === 'string' && c[k].trim()) ? c[k].trim() : '';
    const share = txt('partage') || [txt('slogan'), txt('accroche')].filter(Boolean).join(' ');
    const setContent = v => ({ element(e) { e.setAttribute('content', v); } });
    let rw = new HTMLRewriter();
    if (share) {
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
