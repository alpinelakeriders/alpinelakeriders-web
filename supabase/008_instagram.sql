-- Connexion directe au compte Instagram de l'asso (publication des posts des comptes rendus).
-- Le jeton Instagram est rangé dans une table fermée (RLS sans aucune politique) : personne ne peut la lire
-- directement. Seules ces fonctions y accèdent, et uniquement pour un administrateur connecté.
-- Elles sont appelées par les fonctions Cloudflare du site (functions/api/ig/*), avec le jeton de session de l'admin.
create table if not exists public.ig_connexion (
  id int primary key default 1 check (id = 1),
  token text not null,
  ig_user_id text,
  username text,
  expire timestamptz,
  maj timestamptz not null default now()
);
alter table public.ig_connexion enable row level security;
revoke all on public.ig_connexion from anon, authenticated;

create or replace function public.ig_jeton_set(p_token text, p_user text, p_username text, p_expire timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'reserve aux administrateurs' using errcode = '42501'; end if;
  insert into ig_connexion (id, token, ig_user_id, username, expire, maj) values (1, p_token, p_user, p_username, p_expire, now())
  on conflict (id) do update set token = excluded.token, ig_user_id = coalesce(excluded.ig_user_id, ig_connexion.ig_user_id),
    username = coalesce(excluded.username, ig_connexion.username), expire = excluded.expire, maj = now();
  return true;
end $$;

create or replace function public.ig_jeton_get()
returns table (token text, ig_user_id text, username text, expire timestamptz, maj timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'reserve aux administrateurs' using errcode = '42501'; end if;
  return query select c.token, c.ig_user_id, c.username, c.expire, c.maj from ig_connexion c where c.id = 1;
end $$;

create or replace function public.ig_deconnecter()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'reserve aux administrateurs' using errcode = '42501'; end if;
  delete from ig_connexion; return true;
end $$;

revoke all on function public.ig_jeton_set(text,text,text,timestamptz), public.ig_jeton_get(), public.ig_deconnecter() from public, anon;
grant execute on function public.ig_jeton_set(text,text,text,timestamptz), public.ig_jeton_get(), public.ig_deconnecter() to authenticated;
