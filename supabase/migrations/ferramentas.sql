-- ============================================================
-- Ferramentas (rastreamento de patrimônio/ativos individuais)
-- Vive como categoria dentro de `estoques` (icone = 'wrench')
-- ============================================================

-- Ativos individuais (ferramentas/máquinas)
create table if not exists ferramentas (
  id uuid primary key default gen_random_uuid(),
  estoque_id uuid not null references estoques(id) on delete cascade,
  nome text not null,
  categoria text,
  marca text,
  modelo text,
  numero_serie text,
  valor_aquisicao numeric(12,2),
  data_aquisicao date,
  foto_url text,
  status text not null default 'disponivel'
    check (status in ('disponivel', 'emprestada', 'em_manutencao', 'baixada')),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ferramentas_estoque_id_idx on ferramentas(estoque_id);
create index if not exists ferramentas_status_idx on ferramentas(status);

-- Contrato de empréstimo: 1 funcionário, N ferramentas, impresso e assinado no papel
create table if not exists ferramenta_emprestimos (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios(id),
  obra_id uuid references obras(id),
  data_emprestimo date not null default current_date,
  data_prevista_devolucao date,
  observacoes text,
  responsavel text,
  created_at timestamptz not null default now()
);
create index if not exists ferramenta_emp_funcionario_idx on ferramenta_emprestimos(funcionario_id);

-- Itens do empréstimo (uma linha por ferramenta), com devolução individual
create table if not exists ferramenta_emprestimo_itens (
  id uuid primary key default gen_random_uuid(),
  emprestimo_id uuid not null references ferramenta_emprestimos(id) on delete cascade,
  ferramenta_id uuid not null references ferramentas(id),
  data_devolucao date,
  observacoes_devolucao text,
  created_at timestamptz not null default now()
);
create index if not exists ferramenta_item_emprestimo_idx on ferramenta_emprestimo_itens(emprestimo_id);
create index if not exists ferramenta_item_ferramenta_idx on ferramenta_emprestimo_itens(ferramenta_id);
create index if not exists ferramenta_item_aberto_idx on ferramenta_emprestimo_itens(ferramenta_id) where data_devolucao is null;

-- Defeitos / manutenção
create table if not exists ferramenta_defeitos (
  id uuid primary key default gen_random_uuid(),
  ferramenta_id uuid not null references ferramentas(id) on delete cascade,
  descricao text not null,
  custo numeric(12,2),
  data date not null default current_date,
  resolvido boolean not null default false,
  data_resolucao date,
  created_at timestamptz not null default now()
);
create index if not exists ferramenta_defeitos_ferramenta_idx on ferramenta_defeitos(ferramenta_id);

-- RLS: convenção padrão do app (acesso liberado a autenticados; controle fino em lib/access.ts)
alter table ferramentas enable row level security;
alter table ferramenta_emprestimos enable row level security;
alter table ferramenta_emprestimo_itens enable row level security;
alter table ferramenta_defeitos enable row level security;

create policy "auth_all" on ferramentas for all to authenticated using (true) with check (true);
create policy "auth_all" on ferramenta_emprestimos for all to authenticated using (true) with check (true);
create policy "auth_all" on ferramenta_emprestimo_itens for all to authenticated using (true) with check (true);
create policy "auth_all" on ferramenta_defeitos for all to authenticated using (true) with check (true);

-- Leitura pública só para a ficha do QR (somente SELECT, role anon)
create policy "public_select" on ferramentas for select to anon using (true);
create policy "public_select" on ferramenta_emprestimos for select to anon using (true);
create policy "public_select" on ferramenta_emprestimo_itens for select to anon using (true);
create policy "public_select" on ferramenta_defeitos for select to anon using (true);
