import { json, admin, token, igGet, igPost, SB } from '../../../lib/ig.js';
// Publie une photo ou un carrousel (2 à 10 photos) sur le compte Instagram connecté.
// Les images sont des JPEG déjà déposés dans le stockage public du site (Supabase), seul format accepté par Instagram.
const wait = ms => new Promise(r => setTimeout(r, ms));
async function ready(id, tk) {
  for (let i = 0; i < 20; i++) {
    const d = await igGet('/' + id, { fields: 'status_code', access_token: tk });
    if (d.status_code === 'FINISHED' || !d.status_code) return;
    if (d.status_code === 'ERROR' || d.status_code === 'EXPIRED') throw new Error('Instagram n\'a pas pu lire une image (' + d.status_code + ')');
    await wait(1500);
  }
  throw new Error('Instagram met trop de temps à préparer les images, réessayez dans une minute.');
}
export async function onRequestPost({ request }) {
  const jwt = await admin(request);
  if (!jwt) return json({ error: 'réservé aux administrateurs' }, 401);
  const { images, caption } = await request.json().catch(() => ({}));
  const imgs = (Array.isArray(images) ? images : []).filter(u => typeof u === 'string' && u.startsWith(SB + '/storage/v1/object/public/')).slice(0, 10);
  if (!imgs.length) return json({ error: 'aucune image valable' }, 400);
  const cap = String(caption || '').slice(0, 2200);
  try {
    const c = await token(jwt);
    if (!c) return json({ error: 'Instagram n\'est pas connecté.' }, 400);
    if (c.expired) return json({ error: 'La connexion Instagram a expiré : reconnectez le compte.' }, 400);
    const ig = c.ig_user_id || 'me', tk = c.token;
    let creation;
    if (imgs.length === 1) {
      creation = (await igPost('/' + ig + '/media', { image_url: imgs[0], caption: cap, access_token: tk })).id;
    } else {
      const kids = [];
      for (const u of imgs) kids.push((await igPost('/' + ig + '/media', { image_url: u, is_carousel_item: 'true', access_token: tk })).id);
      for (const k of kids) await ready(k, tk);
      creation = (await igPost('/' + ig + '/media', { media_type: 'CAROUSEL', children: kids.join(','), caption: cap, access_token: tk })).id;
    }
    await ready(creation, tk);
    const pub = await igPost('/' + ig + '/media_publish', { creation_id: creation, access_token: tk });
    let permalink = '';
    try { permalink = (await igGet('/' + pub.id, { fields: 'permalink', access_token: tk })).permalink || ''; } catch (e) {}
    return json({ ok: true, id: pub.id, permalink });
  } catch (e) {
    return json({ error: String(e.message || e) }, 400);
  }
}
