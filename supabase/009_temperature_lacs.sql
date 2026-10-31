-- Température de surface des lacs (déjà appliqué sur le projet Supabase, gardé ici pour mémoire)
-- Alimenté par la fonction Edge « lake-temperature » (Landsat 8-9 via Copernicus + sonde du Bourget),
-- appelée deux fois par jour par pg_cron (job « releve-temperature-lac »).
-- Secrets requis pour la fonction : SH_CLIENT_ID, SH_CLIENT_SECRET (client OAuth Copernicus Data Space).

create table public.lakes (
  slug text primary key, name text not null, commune text,
  lat double precision not null, lon double precision not null,
  half_m integer not null,            -- demi-côté (m) de la zone mesurée au centre du lac
  ordre integer not null default 0,
  live_source text,                   -- URL d'une sonde en direct (JSON), sinon null
  polygon jsonb                       -- zone personnalisée (GeoJSON), sinon carré autour de lat/lon
);
create table public.lake_temperature (
  lake text not null references public.lakes(slug),
  acquired_on date not null,
  temp_c numeric(4,1) not null,
  valid_fraction numeric(4,2),
  source text not null,
  created_at timestamptz not null default now(),
  primary key (lake, acquired_on)
);
create table public.lake_live (
  lake text not null references public.lakes(slug),
  measured_at timestamptz not null,
  temp_c numeric(4,1) not null,
  source text not null,
  primary key (lake, measured_at)
);
alter table public.lakes enable row level security;
alter table public.lake_temperature enable row level security;
alter table public.lake_live enable row level security;
create policy "lecture publique des lacs" on public.lakes for select to anon, authenticated using (true);
create policy "lecture publique des temperatures" on public.lake_temperature for select to anon, authenticated using (true);
create policy "lecture publique mesures directes" on public.lake_live for select to anon, authenticated using (true);

create or replace view public.lake_temperature_latest with (security_invoker = true) as
  select acquired_on, temp_c from public.lake_temperature where lake = 'terrasse' order by acquired_on desc limit 1;

-- Ajouter un lac : insert into public.lakes (slug, name, commune, lat, lon, half_m, ordre)
--   values ('monlac', 'Lac de …', 'Commune (38)', 45.0, 5.0, 100, 8);
-- puis lancer la fonction avec ?days=400&lake=monlac pour récupérer un an d'historique.

-- Filtre des valeurs aberrantes (activé par lac via lakes.outlier_c, ex. 3 °C pour la mer à Carnon) :
-- une mesure est marquée rejected si elle s'écarte de plus de outlier_c de la médiane des ±16 jours
-- et qu'aucune mesure à ±2 jours ne la confirme. Fonction public.flag_lake_outliers(), lancée par
-- pg_cron (job « filtre-valeurs-aberrantes ») 10 min après chaque relevé. Le site ignore rejected = true.
alter table public.lake_temperature add column rejected boolean not null default false;
alter table public.lakes add column outlier_c numeric;
