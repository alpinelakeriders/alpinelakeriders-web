-- Alpine Lake Riders : base de données du site (à coller dans Supabase > SQL Editor > Run)

-- Une table unique de documents, rangés par collection
create table if not exists public.docs (
  collection text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (collection, id),
  constraint docs_taille check (octet_length(data::text) < 20000)
);

-- Administrateurs du site (ajoutés à la main, voir README)
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;
create policy "admins se voient" on public.admins for select using (user_id = auth.uid());

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

alter table public.docs enable row level security;

-- Lecture : contenu public pour tous ; inscriptions réservées aux admins (et à leur auteur)
create policy "lecture" on public.docs for select using (
  collection in ('contenu','sorties','annonces','photos','presences')
  or public.is_admin()
  or (collection = 'inscriptions' and id = auth.uid()::text)
);
-- Écriture : admins partout ; chaque visiteur seulement sa réponse au sondage et sa propre inscription
create policy "ajout" on public.docs for insert with check (
  public.is_admin()
  or (collection in ('presences','inscriptions') and id = auth.uid()::text)
);
create policy "modif" on public.docs for update using (
  public.is_admin()
  or (collection in ('presences','inscriptions') and id = auth.uid()::text)
) with check (
  public.is_admin()
  or (collection in ('presences','inscriptions') and id = auth.uid()::text)
);
create policy "suppression" on public.docs for delete using (public.is_admin());

-- Temps réel (mise à jour instantanée de l'agenda et des sondages)
alter publication supabase_realtime add table public.docs;

-- Stockage des photos du bandeau : lecture publique, envoi réservé aux admins
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/webp','image/jpeg','image/png'])
on conflict (id) do nothing;
create policy "photos ajout admin" on storage.objects for insert with check (bucket_id = 'photos' and public.is_admin());
create policy "photos suppression admin" on storage.objects for delete using (bucket_id = 'photos' and public.is_admin());

-- Contenu de départ : photos par défaut du bandeau et message de fermeture du ponton
insert into public.docs (collection, id, data) values
 ('photos','defaut-1','{"src":"media/session-aerien.jpg","alt":"Vue de drone du ponton et des riders sur le lac","tall":false,"ordre":1}'),
 ('photos','defaut-2','{"src":"media/riders-ponton.jpg","alt":"Riders en combinaison sur le ponton, foils à la main","tall":true,"ordre":2}'),
 ('photos','defaut-3','{"src":"media/aerien-ponton.jpg","alt":"Le ponton en L vu du ciel pendant une session","tall":false,"ordre":3}'),
 ('photos','defaut-4','{"src":"media/depart-ponton.jpg","alt":"Départ en dockstart depuis le ponton","tall":true,"ordre":4}'),
 ('photos','defaut-5','{"src":"media/lac-vert.jpg","alt":"L''eau verte du lac et le ponton","tall":false,"ordre":5}'),
 ('photos','defaut-6','{"src":"media/riders-depart.jpg","alt":"Riders prêts au départ sur le ponton","tall":false,"ordre":6}'),
 ('annonces','fermeture-ponton-2026','{"titre":"Ponton fermé du 1er novembre au 18 décembre","texte":"L''accès au camping étant fermé, nous n''avons temporairement plus accès au ponton. Durant cette période, il est possible de partir de l''autre côté de la berge, sans aller sur les pontons : utilisez vos échelles. Selon le niveau de l''eau, départ possible depuis les souches en face.","fin":"2026-12-18","important":true,"cree":"2026-10-26T12:00:00Z"}')
on conflict do nothing;
