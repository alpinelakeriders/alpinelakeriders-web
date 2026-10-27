-- Compteur de visites anonyme (sans cookie, sans adresse IP).
-- Chaque affichage de la page d'accueil est noté par le serveur Cloudflare :
-- jour, pays (déduit par Cloudflare), type d'appareil, site d'origine, sortie consultée.
create table if not exists public.visites (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  pays text,
  appareil text,
  source text,
  sortie text
);
create index if not exists visites_ts on public.visites (ts);
alter table public.visites enable row level security;
-- aucune lecture/écriture directe : tout passe par les deux fonctions ci-dessous

create or replace function public.log_visite(p_pays text, p_appareil text, p_source text, p_sortie text)
returns void language sql security definer set search_path = public as $$
  insert into public.visites (pays, appareil, source, sortie)
  values (left(upper(p_pays), 2),
          case when p_appareil in ('mobile','tablette','ordinateur') then p_appareil else 'autre' end,
          left(p_source, 80), left(p_sortie, 80));
$$;
revoke all on function public.log_visite(text,text,text,text) from public;
grant execute on function public.log_visite(text,text,text,text) to anon, authenticated;

-- Statistiques pour l'admin uniquement
create or replace function public.stats_visites(p_jours int default 30)
returns json language plpgsql security definer set search_path = public as $$
declare d timestamptz := now() - make_interval(days => greatest(1, least(p_jours, 3650)));
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return json_build_object(
    'total', (select count(*) from visites where ts >= d),
    'aujourdhui', (select count(*) from visites where ts >= date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris'),
    'parJour', coalesce((select json_agg(x order by x.jour) from (select to_char(ts at time zone 'Europe/Paris','YYYY-MM-DD') jour, count(*) n from visites where ts >= d group by 1) x), '[]'),
    'appareils', coalesce((select json_agg(x order by x.n desc) from (select coalesce(appareil,'autre') k, count(*) n from visites where ts >= d group by 1) x), '[]'),
    'pays', coalesce((select json_agg(x order by x.n desc) from (select coalesce(nullif(pays,''),'??') k, count(*) n from visites where ts >= d group by 1 order by 2 desc limit 15) x), '[]'),
    'sources', coalesce((select json_agg(x order by x.n desc) from (select coalesce(nullif(source,''),'direct') k, count(*) n from visites where ts >= d group by 1 order by 2 desc limit 10) x), '[]'),
    'sorties', coalesce((select json_agg(x order by x.n desc) from (select sortie k, count(*) n from visites where ts >= d and sortie is not null and sortie <> '' group by 1 order by 2 desc limit 10) x), '[]')
  );
end $$;
revoke all on function public.stats_visites(int) from public;
grant execute on function public.stats_visites(int) to authenticated;
