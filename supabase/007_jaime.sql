-- « J'aime » sur les comptes rendus des sorties.
-- Les visiteurs n'écrivent jamais directement dans docs : tout passe par cette fonction.
-- Chaque visiteur est un identifiant aléatoire gardé dans son navigateur (pas d'IP, pas de cookie) ; on n'en stocke que l'empreinte md5.
-- Les « j'aime » sont rangés dans la collection « jaime » (lisible par les admins seulement) ;
-- le total est recopié dans la sortie (data.crJaime), qui est publique.
create or replace function public.aimer_cr(p_sortie text, p_visiteur text, p_aime boolean default true)
returns integer language plpgsql security definer set search_path = public as $$
declare s text := btrim(coalesce(p_sortie,'')); v text := btrim(coalesce(p_visiteur,'')); k text; n int;
begin
  if s !~ '^[A-Za-z0-9_-]{1,80}$' or length(v) < 8 or length(v) > 64 then raise exception 'param' using errcode = '22023'; end if;
  if not exists (select 1 from docs where collection = 'sorties' and id = s and data->>'crStatut' = 'publie')
     then raise exception 'compte rendu' using errcode = '22023'; end if;
  k := s || ':' || md5(v);
  if p_aime then
    if (select count(*) from docs where collection = 'jaime' and updated_at > now() - interval '10 minutes') >= 300
       then raise exception 'trop' using errcode = '54000'; end if;
    insert into docs (collection, id, data) values ('jaime', k, json_build_object('sortie', s, 'date', now())::jsonb)
    on conflict (collection, id) do nothing;
  else
    delete from docs where collection = 'jaime' and id = k;
  end if;
  select count(*) into n from docs where collection = 'jaime' and data->>'sortie' = s;
  update docs set data = data || jsonb_build_object('crJaime', n) where collection = 'sorties' and id = s;
  return n;
end $$;
revoke all on function public.aimer_cr(text,text,boolean) from public;
grant execute on function public.aimer_cr(text,text,boolean) to anon, authenticated;
