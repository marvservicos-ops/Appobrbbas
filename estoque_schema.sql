-- =============================================
-- SISTEMA DE ESTOQUE — MARV Gestão
-- Execute no Supabase SQL Editor
-- =============================================

-- Categorias de estoque
create table public.estoque_categorias (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  cor text default '#4F7CFF',
  icone text default 'package',
  created_at timestamptz default now()
);

insert into public.estoque_categorias (nome, cor, icone) values
  ('EPI', '#F59E0B', 'hard-hat'),
  ('Refrigeração', '#4F7CFF', 'thermometer'),
  ('Hidráulico', '#2DD4BF', 'droplets'),
  ('Ferramentas', '#8B5CF6', 'wrench'),
  ('Elétrico', '#EF4444', 'zap'),
  ('Geral', '#64748B', 'package');

-- Itens do estoque
create table public.estoque_itens (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  descricao text,
  categoria_id uuid references public.estoque_categorias(id),
  unidade text not null default 'un',  -- un, m, kg, L, m², etc.
  quantidade_atual numeric not null default 0,
  quantidade_minima numeric not null default 5,
  quantidade_maxima numeric,
  codigo_barras text,
  codigo_interno text,
  foto_url text,
  foto_path text,
  localizacao text,  -- ex: "Prateleira A3"
  preco_unitario numeric,
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Movimentações (entradas e saídas)
create table public.estoque_movimentacoes (
  id uuid default gen_random_uuid() primary key,
  item_id uuid references public.estoque_itens(id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'saida', 'devolucao', 'ajuste')),
  quantidade numeric not null,
  quantidade_devolvida numeric default 0,
  responsavel text not null,
  obra_id uuid references public.obras(id) on delete set null,
  motivo text,
  observacoes text,
  status text default 'concluido' check (status in ('concluido', 'pendente_devolucao', 'devolvido_parcial', 'devolvido_total')),
  data_prevista_devolucao date,
  data_devolucao date,
  created_at timestamptz default now()
);

-- Alertas configurados por item
create table public.estoque_alertas (
  id uuid default gen_random_uuid() primary key,
  item_id uuid references public.estoque_itens(id) on delete cascade,
  tipo text not null check (tipo in ('estoque_baixo', 'estoque_zerado', 'devolucao_pendente')),
  ativo boolean default true,
  created_at timestamptz default now()
);

-- RLS
alter table public.estoque_categorias enable row level security;
alter table public.estoque_itens enable row level security;
alter table public.estoque_movimentacoes enable row level security;
alter table public.estoque_alertas enable row level security;

create policy "auth users" on public.estoque_categorias for all to authenticated using (true) with check (true);
create policy "auth users" on public.estoque_itens for all to authenticated using (true) with check (true);
create policy "auth users" on public.estoque_movimentacoes for all to authenticated using (true) with check (true);
create policy "auth users" on public.estoque_alertas for all to authenticated using (true) with check (true);

-- Storage bucket para fotos de itens
insert into storage.buckets (id, name, public) values ('estoque', 'estoque', true)
on conflict do nothing;

create policy "auth upload estoque" on storage.objects for insert to authenticated with check (bucket_id = 'estoque');
create policy "public read estoque" on storage.objects for select using (bucket_id = 'estoque');
create policy "auth delete estoque" on storage.objects for delete to authenticated using (bucket_id = 'estoque');
