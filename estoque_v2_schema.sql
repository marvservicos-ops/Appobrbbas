-- =============================================
-- SISTEMA DE ESTOQUE V2 — MARV Gestão
-- Estoques separados com campos customizáveis
-- Execute no Supabase SQL Editor
-- =============================================

-- Estoques (workspaces separados)
create table if not exists public.estoques (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  descricao text,
  cor text default '#4F7CFF',
  icone text default 'package',
  created_at timestamptz default now()
);

-- Campos customizados por estoque
create table if not exists public.estoque_campos (
  id uuid default gen_random_uuid() primary key,
  estoque_id uuid references public.estoques(id) on delete cascade,
  nome text not null,
  tipo text not null default 'text' check (tipo in ('text','number','date','unit')),
  obrigatorio boolean default false,
  ordem integer default 0,
  created_at timestamptz default now()
);

-- Produtos de cada estoque
create table if not exists public.estoque_produtos (
  id uuid default gen_random_uuid() primary key,
  estoque_id uuid references public.estoques(id) on delete cascade,
  nome text not null,
  codigo text,
  unidade text default 'un',
  quantidade_atual numeric default 0,
  quantidade_minima numeric default 0,
  ativo boolean default true,
  created_at timestamptz default now()
);

-- Registros de movimentação
create table if not exists public.estoque_registros (
  id uuid default gen_random_uuid() primary key,
  estoque_id uuid references public.estoques(id) on delete cascade,
  produto_id uuid references public.estoque_produtos(id) on delete set null,
  produto_nome text not null,
  tipo text not null default 'saida' check (tipo in ('entrada','saida')),
  quantidade numeric not null,
  unidade text,
  responsavel text not null,
  assinatura_url text,
  data date not null default current_date,
  observacoes text,
  created_at timestamptz default now()
);

-- Valores dos campos customizados por registro
create table if not exists public.estoque_registro_valores (
  id uuid default gen_random_uuid() primary key,
  registro_id uuid references public.estoque_registros(id) on delete cascade,
  campo_id uuid references public.estoque_campos(id) on delete cascade,
  valor text
);

-- RLS
alter table public.estoques enable row level security;
alter table public.estoque_campos enable row level security;
alter table public.estoque_produtos enable row level security;
alter table public.estoque_registros enable row level security;
alter table public.estoque_registro_valores enable row level security;

create policy "auth users" on public.estoques for all to authenticated using (true) with check (true);
create policy "auth users" on public.estoque_campos for all to authenticated using (true) with check (true);
create policy "auth users" on public.estoque_produtos for all to authenticated using (true) with check (true);
create policy "auth users" on public.estoque_registros for all to authenticated using (true) with check (true);
create policy "auth users" on public.estoque_registro_valores for all to authenticated using (true) with check (true);

-- Seed: estoques padrão
insert into public.estoques (nome, cor, icone) values
  ('EPI', '#F59E0B', 'shield'),
  ('Material de Limpeza', '#2DD4BF', 'sparkles'),
  ('Refrigeração', '#4F7CFF', 'thermometer'),
  ('Uniformes', '#8B5CF6', 'shirt'),
  ('Hidráulico', '#06B6D4', 'droplets');

-- Seed: campo nº CA apenas para EPI
insert into public.estoque_campos (estoque_id, nome, tipo, obrigatorio, ordem)
select id, 'Nº CA', 'text', false, 1 from public.estoques where nome = 'EPI';

-- Storage bucket para assinaturas
insert into storage.buckets (id, name, public) values ('assinaturas', 'assinaturas', true)
on conflict do nothing;

create policy "auth upload assinaturas" on storage.objects for insert to authenticated with check (bucket_id = 'assinaturas');
create policy "public read assinaturas" on storage.objects for select using (bucket_id = 'assinaturas');
create policy "auth delete assinaturas" on storage.objects for delete to authenticated using (bucket_id = 'assinaturas');
