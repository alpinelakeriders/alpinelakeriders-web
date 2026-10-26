-- Gestion des administrateurs depuis le site (à lancer une fois dans SQL Editor)

create or replace function public.list_admins() returns table(email text)
language sql stable security definer set search_path = public, auth as $$
  select u.email::text from public.admins a join auth.users u on u.id = a.user_id
  where public.is_admin() order by 1;
$$;

create or replace function public.add_admin(p_email text) returns boolean
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'reserve aux administrateurs'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if uid is null then return false; end if;
  insert into public.admins(user_id) values (uid) on conflict do nothing;
  return true;
end $$;

create or replace function public.remove_admin(p_email text) returns text
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'reserve aux administrateurs'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if uid is null then return 'introuvable'; end if;
  if uid = auth.uid() then return 'soi-meme'; end if;
  if (select count(*) from public.admins) <= 1 then return 'dernier'; end if;
  delete from public.admins where user_id = uid;
  return 'ok';
end $$;

revoke execute on function public.list_admins() from public, anon;
revoke execute on function public.add_admin(text) from public, anon;
revoke execute on function public.remove_admin(text) from public, anon;
grant execute on function public.list_admins() to authenticated;
grant execute on function public.add_admin(text) to authenticated;
grant execute on function public.remove_admin(text) to authenticated;
