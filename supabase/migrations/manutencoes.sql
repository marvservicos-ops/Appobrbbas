-- Contratos de manutenção
create table if not exists contratos_manutencao (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete set null,
  empresa_id uuid references empresas(id) on delete set null,
  numero_contrato text,
  valor_mensal numeric not null default 0,
  data_inicio date not null,
  data_fim date,
  ativo boolean not null default true,
  observacoes text,
  created_at timestamptz default now()
);
alter table contratos_manutencao enable row level security;
create policy "auth_all" on contratos_manutencao for all to authenticated using (true) with check (true);

-- Aditivos
create table if not exists manutencao_aditivos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references contratos_manutencao(id) on delete cascade,
  descricao text not null,
  valor numeric not null default 0,
  data date not null,
  created_at timestamptz default now()
);
alter table manutencao_aditivos enable row level security;
create policy "auth_all" on manutencao_aditivos for all to authenticated using (true) with check (true);

-- Notas Fiscais
create table if not exists manutencao_nfs (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references contratos_manutencao(id) on delete cascade,
  competencia text not null, -- formato YYYY-MM
  valor numeric not null default 0,
  numero_nf text,
  status text not null default 'pendente' check (status in ('pendente', 'emitida')),
  arquivo_url text,
  observacoes text,
  created_at timestamptz default now()
);
alter table manutencao_nfs enable row level security;
create policy "auth_all" on manutencao_nfs for all to authenticated using (true) with check (true);

-- Funcionários alocados
create table if not exists manutencao_funcionarios (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references contratos_manutencao(id) on delete cascade,
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  tipo text not null default 'fixo' check (tipo in ('fixo', 'eventual')),
  unique (contrato_id, funcionario_id)
);
alter table manutencao_funcionarios enable row level security;
create policy "auth_all" on manutencao_funcionarios for all to authenticated using (true) with check (true);

-- Equipamentos
create table if not exists equipamentos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references contratos_manutencao(id) on delete cascade,
  nome text not null,
  tipo text not null default 'Split' check (tipo in ('Split', 'Cassete', 'VRF', 'Janela', 'Piso-teto', 'Outro')),
  marca text,
  modelo text,
  capacidade_btu integer,
  numero_serie text,
  localizacao text,
  data_instalacao date,
  foto_url text,
  ativo boolean not null default true,
  created_at timestamptz default now()
);
alter table equipamentos enable row level security;
create policy "auth_all" on equipamentos for all to authenticated using (true) with check (true);

-- Histórico de manutenções por equipamento
create table if not exists manutencao_historico (
  id uuid primary key default gen_random_uuid(),
  equipamento_id uuid not null references equipamentos(id) on delete cascade,
  competencia text not null, -- formato YYYY-MM
  preventiva_feita boolean not null default false,
  corretiva boolean not null default false,
  corretiva_descricao text,
  corretiva_custo numeric,
  created_at timestamptz default now(),
  unique (equipamento_id, competencia)
);
alter table manutencao_historico enable row level security;
create policy "auth_all" on manutencao_historico for all to authenticated using (true) with check (true);

-- Storage bucket para arquivos de manutenção
insert into storage.buckets (id, name, public) values ('marv-manutencao', 'marv-manutencao', true) on conflict do nothing;
create policy "auth_all_manutencao" on storage.objects for all to authenticated using (bucket_id = 'marv-manutencao') with check (bucket_id = 'marv-manutencao');
