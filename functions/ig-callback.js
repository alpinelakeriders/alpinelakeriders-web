// Retour de la connexion Instagram : on renvoie vers l'admin du site avec le code (échangé ensuite côté serveur)
export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const back = new URL('/', url.origin);
  const code = (url.searchParams.get('code') || '').replace(/#_$/, '');
  if (code) back.searchParams.set('ig_code', code);
  else back.searchParams.set('ig_error', url.searchParams.get('error_description') || url.searchParams.get('error') || 'connexion annulée');
  if (url.searchParams.get('state')) back.searchParams.set('ig_state', url.searchParams.get('state'));
  return Response.redirect(back.toString(), 302);
}
