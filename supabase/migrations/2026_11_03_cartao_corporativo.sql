-- ============================================================
-- Cartão corporativo: prestação de contas mensal
--
-- cartao_lancamentos   → um gasto do cartão (uma linha da fatura ou um
--                        gasto lançado antes da fatura chegar). competencia
--                        é o mês da fatura (aaaa-mm). na_fatura diz se já
--                        bateu com a fatura importada.
-- cartao_comprovantes  → cupom, NF, recibo ou print do pedido. A mesma nota
--                        pode servir a várias parcelas (mesmo path).
-- cartao_fechamentos   → mês conferido e fechado (reabre a qualquer hora).
--
-- Destino do gasto: 'obra' entra no centro de custos da obra; 'empresa'
-- soma em Custos da empresa, na categoria escolhida.
--
-- Só admin mexe. Quem tem 'financeiro' lê os gastos ligados a obra, para o
-- custo da obra fechar igual para todos.
-- ============================================================

create table if not exists public.cartao_lancamentos (
  id uuid primary key default gen_random_uuid(),
  competencia text not null check (competencia ~ '^\d{4}-\d{2}$'),
  data date not null,
  estabelecimento text not null,
  valor numeric(14,2) not null,          -- negativo = estorno/crédito
  parcela text,                          -- "2/5"
  descricao text,                        -- o que foi comprado
  destino text check (destino in ('obra', 'empresa')),
  obra_id uuid references public.obras(id) on delete set null,
  categoria_id uuid references public.categorias_administrativas(id) on delete set null,
  na_fatura boolean not null default false,
  dispensa_comprovante text,             -- motivo (anuidade, IOF, tarifa...)
  observacao text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cartao_lancamentos_competencia on public.cartao_lancamentos (competencia);
create index if not exists cartao_lancamentos_obra on public.cartao_lancamentos (obra_id) where obra_id is not null;

create table if not exists public.cartao_comprovantes (
  id uuid primary key default gen_random_uuid(),
  lancamento_id uuid not null references public.cartao_lancamentos(id) on delete cascade,
  path text not null,
  nome text,
  created_at timestamptz not null default now()
);

create index if not exists cartao_comprovantes_lancamento on public.cartao_comprovantes (lancamento_id);

create table if not exists public.cartao_fechamentos (
  competencia text primary key check (competencia ~ '^\d{4}-\d{2}$'),
  fechado_em timestamptz not null default now(),
  fechado_por uuid default auth.uid()
);

create or replace function public.cartao_lancamentos_carimbo()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cartao_lancamentos_carimbo_trigger on public.cartao_lancamentos;
create trigger cartao_lancamentos_carimbo_trigger
  before update on public.cartao_lancamentos
  for each row execute function public.cartao_lancamentos_carimbo();

alter table public.cartao_lancamentos enable row level security;
alter table public.cartao_comprovantes enable row level security;
alter table public.cartao_fechamentos enable row level security;

drop policy if exists "cartao_lancamentos admin" on public.cartao_lancamentos;
create policy "cartao_lancamentos admin" on public.cartao_lancamentos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "cartao_lancamentos obra financeiro" on public.cartao_lancamentos;
create policy "cartao_lancamentos obra financeiro" on public.cartao_lancamentos
  for select to authenticated using (obra_id is not null and public.has_permission('financeiro'));

drop policy if exists "cartao_comprovantes admin" on public.cartao_comprovantes;
create policy "cartao_comprovantes admin" on public.cartao_comprovantes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "cartao_fechamentos admin" on public.cartao_fechamentos;
create policy "cartao_fechamentos admin" on public.cartao_fechamentos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Comprovantes em bucket privado (abrem por URL assinada)
insert into storage.buckets (id, name, public)
values ('cartao-comprovantes', 'cartao-comprovantes', false)
on conflict (id) do update set public = false;

drop policy if exists "admin le comprovantes cartao" on storage.objects;
create policy "admin le comprovantes cartao" on storage.objects
  for select to authenticated using (bucket_id = 'cartao-comprovantes' and public.is_admin());
drop policy if exists "admin envia comprovantes cartao" on storage.objects;
create policy "admin envia comprovantes cartao" on storage.objects
  for insert to authenticated with check (bucket_id = 'cartao-comprovantes' and public.is_admin());
drop policy if exists "admin atualiza comprovantes cartao" on storage.objects;
create policy "admin atualiza comprovantes cartao" on storage.objects
  for update to authenticated using (bucket_id = 'cartao-comprovantes' and public.is_admin());
drop policy if exists "admin exclui comprovantes cartao" on storage.objects;
create policy "admin exclui comprovantes cartao" on storage.objects
  for delete to authenticated using (bucket_id = 'cartao-comprovantes' and public.is_admin());
