-- Avis des membres : questionnaire sur le site, validation dans l'admin, affichage des avis validés.
-- Les visiteurs n'écrivent jamais directement dans docs : tout passe par donner_avis().
-- La collection « avis » n'est lisible que par les admins (elle n'est pas dans la liste publique).
-- Un avis par navigateur (identifiant aléatoire, on n'en garde que l'empreinte md5) : un nouvel envoi remplace l'ancien.
create or replace function public.donner_avis(p_visiteur text, p_avis jsonb, p_piege text default '')
returns boolean language plpgsql security definer set search_path = public as $$
declare v text := btrim(coalesce(p_visiteur,'')); a jsonb := coalesce(p_avis,'{}'::jsonb);
  notes jsonb := '{}'::jsonb; k text; x int;
  prenom text := btrim(coalesce(a->>'prenom','')); commune text := btrim(coalesce(a->>'commune',''));
  profil text := btrim(coalesce(a->>'profil','')); reco text := btrim(coalesce(a->>'reco',''));
  texte text := btrim(coalesce(a->>'texte','')); ameliorer text := btrim(coalesce(a->>'ameliorer',''));
  meteovu text := btrim(coalesce(a->>'meteoVu',''));
  src text := left(btrim(coalesce(a->>'src','')),20);
begin
  if coalesce(p_piege,'') <> '' then return true; end if;
  if length(v) < 8 or length(v) > 64 then raise exception 'param' using errcode = '22023'; end if;
  foreach k in array array['asso','sortie','installations','ambiance','spot','meteo'] loop
    if a->'notes' ? k and jsonb_typeof(a->'notes'->k) = 'number' then
      x := (a->'notes'->>k)::numeric::int;
      if x < 1 or x > 5 then raise exception 'note' using errcode = '22023'; end if;
      notes := notes || jsonb_build_object(k, x);
    end if;
  end loop;
  if not notes ? 'asso' then raise exception 'note' using errcode = '22023'; end if;
  if reco not in ('','oui','peutetre','non') then raise exception 'reco' using errcode = '22023'; end if;
  if meteovu not in ('','utilise','vu','pasvu') then raise exception 'meteo' using errcode = '22023'; end if;
  if profil not in ('','confirme','debutant','initiation','accompagnant') then raise exception 'profil' using errcode = '22023'; end if;
  if length(prenom) < 2 or length(prenom) > 60 then raise exception 'prenom' using errcode = '22023'; end if;
  if length(commune) > 80 or length(texte) > 1500 or length(ameliorer) > 2000 then raise exception 'long' using errcode = '22023'; end if;
  if (select count(*) from docs where collection = 'avis' and updated_at > now() - interval '10 minutes') >= 60
     then raise exception 'trop' using errcode = '54000'; end if;
  insert into docs (collection, id, data, updated_at)
  values ('avis', 'a-' || md5(v), jsonb_strip_nulls(jsonb_build_object(
      'notes', notes, 'reco', nullif(reco,''), 'meteoVu', nullif(meteovu,''), 'prenom', prenom, 'commune', nullif(commune,''),
      'profil', nullif(profil,''), 'texte', nullif(texte,''), 'ameliorer', nullif(ameliorer,''),
      'accord', coalesce((a->>'accord')::boolean, false), 'src', nullif(src,''),
      'date', now(), 'publie', false, 'lu', false)), now())
  on conflict (collection, id) do update set data = excluded.data, updated_at = now();
  return true;
end $$;
revoke all on function public.donner_avis(text,jsonb,text) from public;
grant execute on function public.donner_avis(text,jsonb,text) to anon, authenticated;

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
      from a where d->>'publie' = 'true' and d->>'accord' = 'true' and d ? 'texte'), '[]'::jsonb));
$$;
revoke all on function public.avis_publics() from public;
grant execute on function public.avis_publics() to anon, authenticated;
