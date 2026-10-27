-- Compteur public du nombre de membres (le total seulement, aucune donnée personnelle)
create or replace function public.nb_membres() returns integer
language sql stable security definer set search_path = public as $$
  select count(distinct
    lower(regexp_replace(trim(coalesce(data->>'nom','')), '\s+', ' ', 'g')) || '|' ||
    lower(regexp_replace(trim(coalesce(data->>'prenom','')), '\s+', ' ', 'g'))
  )::int
  from public.docs where collection in ('membres','inscriptions');
$$;
grant execute on function public.nb_membres() to anon, authenticated;
