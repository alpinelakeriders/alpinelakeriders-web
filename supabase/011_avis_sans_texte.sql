-- Avis publiables même sans texte (affichés avec leurs étoiles seulement). Remplace avis_publics() de 010.
-- Partie publique : moyennes sur tous les avis reçus (hors note « météo », qui concerne le site et pas l'asso) + avis validés par un admin (et acceptés par leur auteur).
-- Ni les remarques « à améliorer » ni le nom de famille ne sortent d'ici.
create or replace function public.avis_publics()
returns jsonb language sql stable security definer set search_path = public as $$
  with a as (select data d from docs where collection = 'avis'),
  n as (select key k, avg(value::text::numeric) m, count(*) c from a, jsonb_each(d->'notes') where key <> 'meteo' group by key)
  select jsonb_build_object(
    'total', (select count(*) from a),
    'moyenne', (select round(avg(value::text::numeric),2) from a, jsonb_each(d->'notes') where key <> 'meteo'),
    'notes', coalesce((select jsonb_object_agg(k, round(m,2)) from n), '{}'::jsonb),
    'reco', (select round(100.0*count(*) filter (where d->>'reco'='oui') / nullif(count(*) filter (where d ? 'reco'),0)) from a),
    'liste', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('prenom', d->>'prenom', 'commune', d->>'commune',
        'profil', d->>'profil', 'notes', d->'notes', 'texte', d->>'texte', 'date', d->>'date')) order by d->>'date' desc)
      from a where d->>'publie' = 'true' and d->>'accord' = 'true'), '[]'::jsonb));
$$;
revoke all on function public.avis_publics() from public;
grant execute on function public.avis_publics() to anon, authenticated;
