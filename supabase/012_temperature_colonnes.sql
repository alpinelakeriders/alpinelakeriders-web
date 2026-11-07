-- Température des lacs : le public ne lit plus que les colonnes affichées sur le site
-- (la colonne « source » reste réservée aux administrateurs et à la fonction de relevé).
revoke select on public.lake_temperature from anon, authenticated;
grant select (lake, acquired_on, temp_c, rejected) on public.lake_temperature to anon, authenticated;
revoke select on public.lake_live from anon, authenticated;
grant select (lake, measured_at, temp_c) on public.lake_live to anon, authenticated;
