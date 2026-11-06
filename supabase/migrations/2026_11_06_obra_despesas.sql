-- ============================================================
-- Despesas diversas da obra (estacionamento, pedágio, combustível,
-- alimentação, Uber, hospedagem...) pagas fora do cartão corporativo.
--
-- Fica na aba "Despesas" da obra, que todo usuário do app acessa
-- (funcionário lança do celular). O valor entra no Centro de Custos
-- e no resultado da obra, no Financeiro.
--
-- Gasto no cartão corporativo NÃO entra aqui (é lançado no Cartão
-- corporativo com destino Obra), senão conta duas vezes.
--
-- RODAR MANUALMENTE no SQL Editor do Supabase. Idempotente.
-- ============================================================

create table if not exists public.obra_despesas (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  data date not null default current_date,
  categoria text not null default 'Outros',
  descricao text,
  valor numeric(14,2) not null check (valor > 0),
  -- pix | dinheiro | reembolso (pago do próprio bolso) | boleto | outro
  forma_pagamento text not null default 'pix',
  pago_por text,                          -- quem pagou (importa no reembolso)
  comprovante_path text,                  -- bucket privado obra-despesas
  comprovante_nome text,
  observacao text,
  criado_por uuid default auth.uid(),
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists obra_despesas_obra_idx on public.obra_despesas (obra_id, data desc);

create or replace function public.obra_despesas_carimbo()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists obra_despesas_carimbo_trigger on public.obra_despesas;
create trigger obra_despesas_carimbo_trigger
  before update on public.obra_despesas
  for each row execute function public.obra_despesas_carimbo();

-- Qualquer usuário logado lança e corrige (mesma regra dos materiais da obra)
alter table public.obra_despesas enable row level security;
drop policy if exists "auth_all" on public.obra_despesas;
create policy "auth_all" on public.obra_despesas
  for all to authenticated using (true) with check (true);

-- Comprovantes em bucket privado (abrem por URL assinada)
insert into storage.buckets (id, name, public)
values ('obra-despesas', 'obra-despesas', false)
on conflict (id) do update set public = false;

drop policy if exists "auth le comprovantes despesas" on storage.objects;
create policy "auth le comprovantes despesas" on storage.objects
  for select to authenticated using (bucket_id = 'obra-despesas');
drop policy if exists "auth envia comprovantes despesas" on storage.objects;
create policy "auth envia comprovantes despesas" on storage.objects
  for insert to authenticated with check (bucket_id = 'obra-despesas');
drop policy if exists "auth atualiza comprovantes despesas" on storage.objects;
create policy "auth atualiza comprovantes despesas" on storage.objects
  for update to authenticated using (bucket_id = 'obra-despesas');
drop policy if exists "auth exclui comprovantes despesas" on storage.objects;
create policy "auth exclui comprovantes despesas" on storage.objects
  for delete to authenticated using (bucket_id = 'obra-despesas');
