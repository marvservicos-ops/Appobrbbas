-- ============================================================
-- Materiais de obra: custo por obra sem exigir inventário completo
--
-- 1. Categorias de produto por estoque (Fixação, Suportação...),
--    editáveis, para filtrar a lista e agrupar o custo na obra.
-- 2. controla_saldo no produto: quando false a saída não exige
--    saldo e quantidade_atual vira "saldo conhecido" (só o que
--    voltou de obra), nunca negativo. Ligar depois com inventário.
-- 3. sobra_mista no produto: item em kg que recebe a sobra
--    misturada que volta da obra, creditada pelo R$/kg
--    (preco_unitario do próprio produto).
-- 4. Grandezas da obra (máquinas, TR, m² de duto...) para o
--    índice de custo, e previsão de consumo para previsto x real.
-- ============================================================

create table if not exists estoque_produto_categorias (
  id uuid primary key default gen_random_uuid(),
  estoque_id uuid not null references estoques(id) on delete cascade,
  nome text not null,
  cor text not null default '#64748B',
  ordem int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists estoque_produto_categorias_estoque_idx on estoque_produto_categorias(estoque_id);

alter table public.estoque_produtos
  add column if not exists categoria_id uuid references estoque_produto_categorias(id) on delete set null,
  add column if not exists controla_saldo boolean not null default true,
  add column if not exists sobra_mista boolean not null default false;

-- Log de ajustes manuais de saldo (inventário). A tela já gravava aqui.
create table if not exists estoque_logs (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid references estoque_produtos(id) on delete cascade,
  estoque_id uuid references estoques(id) on delete cascade,
  tipo text not null,
  quantidade_anterior numeric,
  quantidade_nova numeric,
  motivo text,
  created_at timestamptz not null default now()
);

create table if not exists obra_grandezas (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  nome text not null,
  unidade text,
  valor numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists obra_grandezas_obra_idx on obra_grandezas(obra_id);

-- Previsão por produto (em quantidade) ou por categoria (em R$)
create table if not exists obra_previsao_materiais (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  produto_id uuid references estoque_produtos(id) on delete cascade,
  categoria_id uuid references estoque_produto_categorias(id) on delete cascade,
  quantidade numeric,
  valor numeric,
  observacao text,
  created_at timestamptz not null default now(),
  check (produto_id is not null or categoria_id is not null)
);
create index if not exists obra_previsao_materiais_obra_idx on obra_previsao_materiais(obra_id);

alter table estoque_produto_categorias enable row level security;
alter table estoque_logs enable row level security;
alter table obra_grandezas enable row level security;
alter table obra_previsao_materiais enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'estoque_produto_categorias' and policyname = 'auth_all') then
    create policy "auth_all" on estoque_produto_categorias for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'estoque_logs' and policyname = 'auth_all') then
    create policy "auth_all" on estoque_logs for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'obra_grandezas' and policyname = 'auth_all') then
    create policy "auth_all" on obra_grandezas for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'obra_previsao_materiais' and policyname = 'auth_all') then
    create policy "auth_all" on obra_previsao_materiais for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Categorias iniciais e item de sobra mista no estoque "Materiais de Consumo"
insert into estoque_produto_categorias (estoque_id, nome, cor, ordem)
select e.id, c.nome, c.cor, c.ordem
from estoques e
cross join (values
  ('Fixação', '#4F7CFF', 1),
  ('Suportação', '#8B5CF6', 2),
  ('Isolamento e vedação', '#F59E0B', 3),
  ('Refrigeração', '#06B6D4', 4),
  ('Elétrica', '#EF4444', 5),
  ('Consumíveis de ferramenta', '#64748B', 6)
) as c(nome, cor, ordem)
where e.nome ilike 'Materiais de Consumo'
  and not exists (select 1 from estoque_produto_categorias x where x.estoque_id = e.id);

insert into estoque_produtos (estoque_id, nome, unidade, quantidade_atual, quantidade_minima, controla_saldo, sobra_mista, categoria_id)
select e.id, 'Sobra mista de fixação', 'kg', 0, 0, false, true,
  (select id from estoque_produto_categorias c where c.estoque_id = e.id and c.nome = 'Fixação' limit 1)
from estoques e
where e.nome ilike 'Materiais de Consumo'
  and not exists (select 1 from estoque_produtos p where p.estoque_id = e.id and p.sobra_mista);
