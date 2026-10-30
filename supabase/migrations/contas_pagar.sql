-- ============================================================
-- Contas a pagar e conciliação DDA (Fase 1)
--
-- fornecedores   → cadastro com CNPJ (é por ele que o DDA identifica
--                  o beneficiário). Liberado a todos os usuários.
-- notas_compra   → cabeçalho da NF de compra.
-- contas_pagar   → um boleto/parcela por linha; é o que aparece no DDA.
--                  Pode existir sem nota (boleto avulso ou boleto que
--                  apareceu no DDA sem registro).
--
-- Notas e contas exigem a permissão 'contas_pagar' (admin sempre pode).
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nome_fantasia text,
  cnpj text,                       -- só dígitos (CNPJ ou CPF)
  telefone text,
  email text,
  observacao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists fornecedores_cnpj_unico
  on public.fornecedores (cnpj) where cnpj is not null and cnpj <> '';

create table if not exists public.notas_compra (
  id uuid primary key default gen_random_uuid(),
  fornecedor_id uuid not null references public.fornecedores(id) on delete restrict,
  numero_nf text,
  data_emissao date,
  data_entrada date not null default current_date,
  valor_total numeric(14,2) not null default 0 check (valor_total >= 0),
  obra_id uuid references public.obras(id) on delete set null,
  observacao text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.contas_pagar (
  id uuid primary key default gen_random_uuid(),
  nota_id uuid references public.notas_compra(id) on delete cascade,
  fornecedor_id uuid not null references public.fornecedores(id) on delete restrict,
  parcela int,
  descricao text,
  data_vencimento date not null,
  valor numeric(14,2) not null check (valor >= 0),
  status text not null default 'pendente'
    check (status in ('pendente', 'conferido_dda', 'pago', 'divergente', 'cancelado')),
  motivo_divergencia text,
  data_pagamento date,
  observacao text,
  status_atualizado_em timestamptz,
  status_atualizado_por uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contas_pagar_vencimento on public.contas_pagar (data_vencimento);
create index if not exists contas_pagar_nota on public.contas_pagar (nota_id);
create index if not exists notas_compra_fornecedor on public.notas_compra (fornecedor_id);

-- Registra quem mudou o status e quando (histórico mínimo da conferência)
create or replace function public.contas_pagar_carimbo()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.status_atualizado_em = now();
    new.status_atualizado_por = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists contas_pagar_carimbo_trigger on public.contas_pagar;
create trigger contas_pagar_carimbo_trigger
  before insert or update on public.contas_pagar
  for each row execute function public.contas_pagar_carimbo();

alter table public.fornecedores enable row level security;
alter table public.notas_compra enable row level security;
alter table public.contas_pagar enable row level security;

drop policy if exists "fornecedores auth" on public.fornecedores;
create policy "fornecedores auth" on public.fornecedores
  for all to authenticated using (true) with check (true);

drop policy if exists "notas_compra contas_pagar" on public.notas_compra;
create policy "notas_compra contas_pagar" on public.notas_compra
  for all to authenticated
  using (public.has_permission('contas_pagar'))
  with check (public.has_permission('contas_pagar'));

drop policy if exists "contas_pagar contas_pagar" on public.contas_pagar;
create policy "contas_pagar contas_pagar" on public.contas_pagar
  for all to authenticated
  using (public.has_permission('contas_pagar'))
  with check (public.has_permission('contas_pagar'));
