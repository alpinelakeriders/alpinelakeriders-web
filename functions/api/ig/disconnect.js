import { json, admin, rpc } from '../../../lib/ig.js';
export async function onRequestPost({ request }) {
  const jwt = await admin(request);
  if (!jwt) return json({ error: 'réservé aux administrateurs' }, 401);
  try { await rpc(jwt, 'ig_deconnecter'); return json({ ok: true }); } catch (e) { return json({ error: String(e.message || e) }, 400); }
}
