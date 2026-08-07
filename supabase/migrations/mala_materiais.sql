-- ============================================================
-- Materiais de uso (consumíveis) dentro de uma mala de ferramentas
-- ============================================================
-- Uma mala é uma linha de `ferramentas` com eh_mala = true. Ferramentas
-- individuais entram nela via `ferramentas.mala_id`. Materiais de consumo
-- (fita, cola, gás de maçarico etc.) não são equipamentos rastreados
-- individualmente — seguem o mesmo padrão de `manutencao_estoque_produtos`
-- / `manutencao_estoque_registros`, só que escopados por mala.

create table if not exists mala_estoque_produtos (
  id uuid primary key default gen_random_uuid(),
  mala_id uuid not null references ferramentas(id) on delete cascade,
  produto_id uuid not null references estoque_produtos(id) on delete cascade,
  quantidade_atual numeric not null default 0,
  quantidade_minima numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (mala_id, produto_id)
);

create table if not exists mala_estoque_registros (
  id uuid primary key default gen_random_uuid(),
  mala_id uuid not null references ferramentas(id) on delete cascade,
  produto_id uuid not null references estoque_produtos(id),
  tipo text not null check (tipo in ('entrada', 'saida')),
  quantidade numeric not null,
  responsavel text,
  data date not null default current_date,
  observacoes text,
  -- referência à saída original do estoque geral, quando o material chega
  -- na mala via retirada do estoque central (recurso futuro).
  origem_estoque_registro_id uuid references estoque_registros(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table mala_estoque_produtos enable row level security;
alter table mala_estoque_registros enable row level security;
create policy "auth_all" on mala_estoque_produtos for all to authenticated using (true) with check (true);
create policy "auth_all" on mala_estoque_registros for all to authenticated using (true) with check (true);
