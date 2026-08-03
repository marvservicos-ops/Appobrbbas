-- ============================================================
-- Módulo ESG: combustível, investimentos (melhorias), destinação
-- de materiais e reciclagem de gás refrigerante.
-- ============================================================

create table if not exists esg_combustivel (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  veiculo_id uuid references veiculos(id) on delete set null,
  combustivel text not null,
  litros numeric not null,
  valor numeric not null default 0,
  observacoes text,
  created_at timestamptz not null default now()
);
create index if not exists esg_combustivel_veiculo_idx on esg_combustivel(veiculo_id);

create table if not exists esg_investimentos (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  item text not null,
  categoria text not null check (categoria in ('Ambiental', 'Social', 'Ferramental', 'SST')),
  quantidade numeric not null default 1,
  valor numeric not null default 0,
  observacoes text,
  created_at timestamptz not null default now()
);

create table if not exists esg_destinacao_materiais (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  cliente text not null,
  material text not null,
  quantidade numeric not null,
  valor numeric,
  observacoes text,
  created_at timestamptz not null default now()
);

create table if not exists esg_reciclagem_gas (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  empresa_emissora text not null,
  manutencao_contrato_id uuid references contratos_manutencao(id) on delete set null,
  tipo_gas text not null,
  quantidade numeric not null,
  valor_recebido numeric,
  observacoes text,
  created_at timestamptz not null default now()
);
create index if not exists esg_reciclagem_gas_contrato_idx on esg_reciclagem_gas(manutencao_contrato_id);

alter table esg_combustivel enable row level security;
alter table esg_investimentos enable row level security;
alter table esg_destinacao_materiais enable row level security;
alter table esg_reciclagem_gas enable row level security;

create policy "auth_all" on esg_combustivel for all to authenticated using (true) with check (true);
create policy "auth_all" on esg_investimentos for all to authenticated using (true) with check (true);
create policy "auth_all" on esg_destinacao_materiais for all to authenticated using (true) with check (true);
create policy "auth_all" on esg_reciclagem_gas for all to authenticated using (true) with check (true);
