# Site Alpine Lake Riders

Site statique (HTML, CSS, JS) hébergé sur Cloudflare Pages. Les données modifiables (textes, agenda, sondages, messages, photos du bandeau, inscriptions) sont dans Supabase.

## Mise en place (une seule fois)

### 1. Supabase (base de données et connexion admin)
1. Créer un compte sur https://supabase.com puis « New project » (région : Paris ou Francfort, mot de passe de base : à garder de côté).
2. **SQL Editor** > New query : coller tout le fichier `supabase/schema.sql`, puis **Run**.
3. **Authentication > Sign In / Providers** : activer **Allow anonymous sign-ins** (sert aux sondages et inscriptions des visiteurs).
4. **Authentication > Users > Add user** : créer le compte administrateur (e-mail + mot de passe, cocher « Auto confirm »).
5. **SQL Editor** : donner les droits admin à ce compte :
   `insert into admins (user_id) select id from auth.users where email = 'ton@email.fr';`
6. **Project Settings > API** : copier l'URL du projet et la clé `anon public` dans `js/config.js`.

### 2. Cloudflare Pages (hébergement)
1. Créer un compte sur https://dash.cloudflare.com.
2. **Workers & Pages > Create > Pages > Connect to Git** : choisir ce dépôt GitHub.
3. Framework preset : *None*. Build command : vide. Output directory : `/`.
4. **Save and Deploy**. Le site est en ligne sur `xxx.pages.dev`.
5. **Custom domains** : ajouter le nom de domaine acheté et suivre les instructions DNS.

## Mises à jour
- Textes, horaires, agenda, messages, photos : depuis le site, lien « Administration » en bas de page.
- Design ou nouvelles sections : demander à Claude, qui modifie ce dépôt. Cloudflare republie automatiquement en une minute.
