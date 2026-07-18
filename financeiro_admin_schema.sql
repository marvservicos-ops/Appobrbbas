-- MARV Gestão: perfis, permissões e controle financeiro por obra
-- Execute este arquivo no SQL Editor do Supabase antes de publicar as telas.

create extension if not exists pgcrypto;

create table if not exists public.app_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nome text,
  cargo text,
  role text not null default 'usuario' check (role in ('admin', 'usuario')),
  permissions text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_app_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.app_profiles (id, email, nome, cargo)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'full_name'),
    new.raw_user_meta_data->>'cargo'
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_app_profile on auth.users;
create trigger on_auth_user_created_app_profile
  after insert or update of email on auth.users
  for each row execute function public.handle_new_app_user();

insert into public.app_profiles (id, email, nome)
select id, coalesce(email, ''), coalesce(raw_user_meta_data->>'nome', raw_user_meta_data->>'full_name')
from auth.users
on conflict (id) do update set email = excluded.email;

update public.app_profiles
set role = 'admin', permissions = array['financeiro', 'usuarios'], active = true
where lower(email) = 'joaovictor@marvservicos.com.br';

create or replace function public.protect_primary_admin()
returns trigger
language plpgsql
as $$
begin
  if lower(old.email) = 'joaovictor@marvservicos.com.br'
     and (new.role <> 'admin' or not new.active) then
    raise exception 'O administrador principal não pode ser desativado ou rebaixado';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists protect_primary_admin_trigger on public.app_profiles;
create trigger protect_primary_admin_trigger
  before update on public.app_profiles
  for each row execute function public.protect_primary_admin();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.app_profiles
    where id = auth.uid() and role = 'admin' and active
  );
$$;

create or replace function public.has_permission(permission_name text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.app_profiles
    where id = auth.uid()
      and active
      and (role = 'admin' or permission_name = any(permissions))
  );
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.has_permission(text) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_permission(text) to authenticated;

alter table public.app_profiles enable row level security;
drop policy if exists "profile read own or admin" on public.app_profiles;
create policy "profile read own or admin" on public.app_profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "admin manages profiles" on public.app_profiles;
create policy "admin manages profiles" on public.app_profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "user updates own basic profile" on public.app_profiles;

create table if not exists public.obra_medicoes (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  ordem integer not null,
  nome text not null,
  percentual numeric(6,3) not null check (percentual > 0 and percentual <= 100),
  valor_previsto numeric(14,2) not null default 0 check (valor_previsto >= 0),
  status text not null default 'planejada' check (status in ('planejada', 'faturada', 'recebida', 'atrasada', 'cancelada')),
  data_prevista date,
  data_emissao date,
  data_vencimento date,
  data_pagamento date,
  valor_faturado numeric(14,2) check (valor_faturado >= 0),
  valor_recebido numeric(14,2) check (valor_recebido >= 0),
  numero_nf text,
  nf_nome text,
  nf_path text,
  observacoes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (obra_id, ordem)
);

create index if not exists obra_medicoes_obra_id_idx on public.obra_medicoes(obra_id);
create index if not exists obra_medicoes_status_idx on public.obra_medicoes(status);

create or replace function public.validate_medicao_total()
returns trigger
language plpgsql
as $$
declare total numeric;
begin
  select coalesce(sum(percentual), 0) into total
  from public.obra_medicoes
  where obra_id = new.obra_id and id <> new.id and status <> 'cancelada';
  if new.status <> 'cancelada' and total + new.percentual > 100.000 then
    raise exception 'A soma das etapas não pode ultrapassar 100%%';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists validate_medicao_total_trigger on public.obra_medicoes;
create trigger validate_medicao_total_trigger
  before insert or update on public.obra_medicoes
  for each row execute function public.validate_medicao_total();

alter table public.obra_medicoes enable row level security;
drop policy if exists "financeiro reads medicoes" on public.obra_medicoes;
create policy "financeiro reads medicoes" on public.obra_medicoes
  for select to authenticated using (public.has_permission('financeiro'));
drop policy if exists "financeiro inserts medicoes" on public.obra_medicoes;
create policy "financeiro inserts medicoes" on public.obra_medicoes
  for insert to authenticated with check (public.has_permission('financeiro'));
drop policy if exists "financeiro updates medicoes" on public.obra_medicoes;
create policy "financeiro updates medicoes" on public.obra_medicoes
  for update to authenticated using (public.has_permission('financeiro')) with check (public.has_permission('financeiro'));
drop policy if exists "financeiro deletes medicoes" on public.obra_medicoes;
create policy "financeiro deletes medicoes" on public.obra_medicoes
  for delete to authenticated using (public.has_permission('financeiro'));

insert into storage.buckets (id, name, public)
values ('notas-fiscais-emitidas', 'notas-fiscais-emitidas', false)
on conflict (id) do update set public = false;

drop policy if exists "financeiro le notas emitidas" on storage.objects;
create policy "financeiro le notas emitidas" on storage.objects
  for select to authenticated using (
    bucket_id = 'notas-fiscais-emitidas' and public.has_permission('financeiro')
  );
drop policy if exists "financeiro envia notas emitidas" on storage.objects;
create policy "financeiro envia notas emitidas" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'notas-fiscais-emitidas' and public.has_permission('financeiro')
  );
drop policy if exists "financeiro atualiza notas emitidas" on storage.objects;
create policy "financeiro atualiza notas emitidas" on storage.objects
  for update to authenticated using (
    bucket_id = 'notas-fiscais-emitidas' and public.has_permission('financeiro')
  );
drop policy if exists "financeiro exclui notas emitidas" on storage.objects;
create policy "financeiro exclui notas emitidas" on storage.objects
  for delete to authenticated using (
    bucket_id = 'notas-fiscais-emitidas' and public.has_permission('financeiro')
  );
