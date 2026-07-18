-- Execute no SQL Editor do Supabase para mover o valor do contrato para a área financeira.
create table if not exists public.obra_financeiro (
  obra_id uuid primary key references public.obras(id) on delete cascade,
  valor_contrato numeric(14,2) not null default 0 check (valor_contrato >= 0),
  updated_at timestamptz not null default now()
);

-- Migra valores antigos antes de removê-los da área comum.
insert into public.obra_financeiro (obra_id, valor_contrato)
select id, coalesce(valor_estimado, 0) from public.obras where coalesce(valor_estimado, 0) > 0
on conflict (obra_id) do nothing;

alter table public.obra_financeiro enable row level security;
create policy "financeiro le contrato" on public.obra_financeiro for select to authenticated using (public.has_permission('financeiro'));
create policy "financeiro cria contrato" on public.obra_financeiro for insert to authenticated with check (public.has_permission('financeiro'));
create policy "financeiro atualiza contrato" on public.obra_financeiro for update to authenticated using (public.has_permission('financeiro')) with check (public.has_permission('financeiro'));

-- Remove definitivamente o dado financeiro da tabela acessível aos engenheiros.
alter table public.obras drop column if exists valor_estimado;
