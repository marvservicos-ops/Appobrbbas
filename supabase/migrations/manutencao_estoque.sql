-- ============================================================
-- Estoque de material dentro do cliente (contrato de manutenção)
-- ============================================================

-- estoque_registros.obra_id/funcionario_id/destino_tipo já existem no banco
-- (adicionados fora de migração rastreada); manutencao_id segue a mesma
-- convenção, mas fica rastreado desde já.
alter table estoque_registros add column if not exists manutencao_id uuid references contratos_manutencao(id) on delete set null;

-- Quais produtos do catálogo central são rastreados em cada contrato de
-- manutenção, e quanto tem disponível lá.
create table if not exists manutencao_estoque_produtos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references contratos_manutencao(id) on delete cascade,
  produto_id uuid not null references estoque_produtos(id) on delete cascade,
  quantidade_atual numeric not null default 0,
  quantidade_minima numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (contrato_id, produto_id)
);

-- Histórico de entrada/saída no estoque local do cliente.
create table if not exists manutencao_estoque_registros (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references contratos_manutencao(id) on delete cascade,
  produto_id uuid not null references estoque_produtos(id),
  tipo text not null check (tipo in ('entrada', 'saida')),
  quantidade numeric not null,
  responsavel text,
  data date not null default current_date,
  observacoes text,
  origem_estoque_registro_id uuid references estoque_registros(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table manutencao_estoque_produtos enable row level security;
alter table manutencao_estoque_registros enable row level security;
create policy "auth_all" on manutencao_estoque_produtos for all to authenticated using (true) with check (true);
create policy "auth_all" on manutencao_estoque_registros for all to authenticated using (true) with check (true);
