-- Com o RLS ativo, garante as políticas das listas de saúde e mantém o cadastro
-- de novos usuários funcionando.

-- 1) Listas de saúde: as mesmas regras de entries/categories, escopadas por usuário.
alter table public.health_events enable row level security;

drop policy if exists health_events_select on public.health_events;
drop policy if exists health_events_insert on public.health_events;
drop policy if exists health_events_update on public.health_events;
drop policy if exists health_events_delete on public.health_events;

create policy health_events_select on public.health_events
  for select to authenticated using (auth.uid() = user_id);

create policy health_events_insert on public.health_events
  for insert to authenticated with check (auth.uid() = user_id);

create policy health_events_update on public.health_events
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy health_events_delete on public.health_events
  for delete to authenticated using (auth.uid() = user_id);

-- 2) Funções que criam a linha de profiles durante o cadastro (trigger em auth.users)
-- precisam rodar como SECURITY DEFINER: com o RLS ligado em profiles, um insert
-- feito pelo papel do Auth não passa por nenhuma política e o cadastro falha.
do $$
declare
  f record;
begin
  for f in
    select p.proname as nome,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'handle_new_user',
        'novo_usuario',
        'criar_perfil_novo_usuario',
        'create_profile_for_new_user'
      )
  loop
    execute format('alter function public.%I(%s) security definer', f.nome, f.args);
    execute format('alter function public.%I(%s) set search_path = public', f.nome, f.args);
  end loop;
end $$;
