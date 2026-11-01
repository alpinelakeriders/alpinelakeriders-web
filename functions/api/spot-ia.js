import { json, admin } from '../../lib/ig.js';
// Ajout d'un spot à partir de photos (admins seulement), deux étapes confiées à Claude :
//  - action « photos » : vérifie qu'il y a de l'eau sur chaque photo et décrit ce qu'on voit (ponton, quai, plage…)
//  - action « texte »  : corrige et met en forme la dictée de l'admin, en fiche de spot structurée
// Secret attendu dans Cloudflare Pages (Réglages > Variables et secrets) : ANTHROPIC_API_KEY.

const MODEL = 'claude-opus-5-5';

const S_PHOTOS = {
  type: 'object', additionalProperties: false, required: ['photos', 'resume'],
  properties: {
    photos: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['eau', 'vu'],
      properties: { eau: { type: 'boolean' }, vu: { type: 'string' } } } },
    resume: { type: 'string' },
  },
};
const S_TEXTE = {
  type: 'object', additionalProperties: false,
  required: ['n', 't', 'c', 'pub', 'aut', 'ac', 'a', 'st', 'f', 's', 'rm', 'manque'],
  properties: {
    n: { type: 'string' }, t: { type: 'string' },
    c: { type: 'string', enum: ['ponton', 'club', 'lac', 'port'] },
    pub: { type: 'string', enum: ['public', 'prive', '?'] },
    aut: { type: 'string', enum: ['oui', 'non', '?'] },
    ac: { type: 'string', enum: ['libre', 'club', 'event', 'restreint'] },
    a: { type: 'string' }, st: { type: 'string' }, f: { type: 'string' }, s: { type: 'string' },
    rm: { type: 'string' }, manque: { type: 'array', items: { type: 'string' } },
  },
};

async function claude(env, content, schema, maxTokens) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2026-10-21', 'anthropic-beta': 'server-side-fallback-2026-07-01',
    },
    body: JSON.stringify({
      model: MODEL, max_tokens: maxTokens, fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content }],
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d.error && d.error.message) || ('IA ' + r.status));
  if (d.stop_reason === 'refusal') throw new Error('L\'IA a refusé cette demande.');
  const txt = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  return JSON.parse(txt);
}

export async function onRequestPost({ request, env }) {
  if (!(await admin(request))) return json({ error: 'réservé aux administrateurs' }, 401);
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'cle', message: 'Clé ANTHROPIC_API_KEY absente dans Cloudflare.' }, 503);
  const b = await request.json().catch(() => ({}));
  try {
    if (b.action === 'photos') {
      const imgs = (Array.isArray(b.images) ? b.images : []).filter(s => typeof s === 'string' && s.length < 2_000_000).slice(0, 3);
      if (!imgs.length) return json({ error: 'aucune photo' }, 400);
      const content = imgs.map(s => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: s.replace(/^data:image\/\w+;base64,/, '') } }));
      content.push({ type: 'text', text:
        `Ces ${imgs.length} photo(s) doivent montrer un spot de pumpfoil (départ en dockstart depuis un ponton, un quai, une digue ou une plage). ` +
        'Pour chaque photo, dans l\'ordre : eau = true seulement si on voit nettement une étendue d\'eau (lac, rivière, mer, bassin, canal) ; ' +
        'vu = une phrase courte en français qui décrit ce qu\'on voit d\'utile pour un rider (type de ponton ou de quai, hauteur au-dessus de l\'eau, matériau, accès, plage, bouées…). ' +
        'resume = une à deux phrases en français qui résument le spot vu sur l\'ensemble des photos. N\'invente rien qui ne soit pas visible.' });
      return json(await claude(env, content, S_PHOTOS, 2000));
    }
    if (b.action === 'texte') {
      const dictee = String(b.texte || '').slice(0, 4000);
      const ctx = b.contexte && typeof b.contexte === 'object' ? JSON.stringify(b.contexte).slice(0, 3000) : '{}';
      const text =
        'Tu aides l\'association Alpine Lake Riders à remplir l\'annuaire des spots de pumpfoil. Un administrateur a dicté (dictée vocale, donc fautes et mots mal reconnus possibles) une description du spot. ' +
        'Corrige l\'orthographe et la grammaire, remets les mots mal reconnus dans le bon sens (pumpfoil, dockstart, ponton, foil, wing…), et range l\'information dans la fiche. ' +
        'N\'invente rien : si une information n\'est ni dans la dictée ni dans le contexte, laisse le champ vide (ou « ? » pour pub et aut) et ajoute dans « manque » une courte question en français.\n\n' +
        'Champs : n = nom court du spot (ex. « Lac de Paladru – ponton de la plage », sans nom de marque de foil) ; t = type de départ en quelques mots (ponton flottant, ponton fixe, quai, digue, plage, échelle…) ; ' +
        'c = catégorie (ponton = ponton/quai libre, club = géré par un club ou une école, lac = plage ou berge de lac, port = port) ; pub = ponton public ou privé ; aut = faut-il demander l\'autorisation (oui/non/?) ; ' +
        'ac = accès (libre, club = via club ou école, event = seulement lors d\'événements, restreint) ; a = accès en quelques mots (ex. « libre, hors zone de baignade ») ; st = qui gère le lieu si connu ; ' +
        'f = fréquentation ; s = saison ou horaires ; rm = description mise en forme, 1 à 4 phrases claires en français, à partir de la dictée corrigée (conseils, parking, profondeur, dangers…).\n\n' +
        'Contexte (position, lieu trouvé sur la carte, analyse des photos) : ' + ctx + '\n\nDictée : « ' + dictee + ' »';
      return json(await claude(env, [{ type: 'text', text }], S_TEXTE, 3000));
    }
    return json({ error: 'action inconnue' }, 400);
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
}
