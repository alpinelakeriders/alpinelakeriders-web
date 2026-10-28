-- Formulaire « Nous contacter » : ajout du téléphone (facultatif) laissé par le visiteur.
-- Nouvelle version à 5 paramètres ; l'ancienne (4 paramètres) reste pour compatibilité.
create or replace function public.envoyer_contact(p_nom text, p_email text, p_tel text, p_message text, p_piege text default '')
returns boolean language plpgsql security definer set search_path = public as $$
declare n text := btrim(coalesce(p_nom,'')); e text := btrim(coalesce(p_email,'')); t text := btrim(coalesce(p_tel,'')); m text := btrim(coalesce(p_message,''));
begin
  if coalesce(p_piege,'') <> '' then return true; end if;
  if length(n) < 2 or length(n) > 120 then raise exception 'nom' using errcode = '22023'; end if;
  if e !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(e) > 200 then raise exception 'email' using errcode = '22023'; end if;
  if t <> '' and t !~ '^[+()0-9][0-9 .()+-]{5,29}$' then raise exception 'tel' using errcode = '22023'; end if;
  if length(m) < 5 or length(m) > 4000 then raise exception 'message' using errcode = '22023'; end if;
  if (select count(*) from docs where collection = 'contacts' and (data->>'date')::timestamptz > now() - interval '10 minutes') >= 20
     then raise exception 'trop' using errcode = '54000'; end if;
  if exists (select 1 from docs where collection = 'contacts' and lower(data->>'email') = lower(e) and data->>'message' = m)
     then return true; end if;
  insert into docs (collection, id, data)
  values ('contacts', 'c-' || to_char(now(),'YYYYMMDDHH24MISS') || '-' || substr(md5(random()::text),1,6),
          jsonb_strip_nulls(json_build_object('nom', n, 'email', e, 'tel', nullif(t,''), 'message', m, 'date', now(), 'lu', false)::jsonb));
  return true;
end $$;
revoke all on function public.envoyer_contact(text,text,text,text,text) from public;
grant execute on function public.envoyer_contact(text,text,text,text,text) to anon, authenticated;
