-- ═══════════════════════════════════════════════
-- RDO - Relatório Diário de Obra
-- Rode este script no SQL Editor do Supabase
-- ═══════════════════════════════════════════════

create table if not exists public.rdos (
  id uuid default gen_random_uuid() primary key,
  obra_id uuid references public.obras(id) on delete cascade not null,
  numero int not null,
  data date not null default current_date,
  status text not null default 'preenchendo',
  indice_pluviometrico text,
  created_at timestamptz default now()
);

create table if not exists public.rdo_clima (
  id uuid default gen_random_uuid() primary key,
  rdo_id uuid references public.rdos(id) on delete cascade not null,
  periodo text not null,
  ativo boolean default true,
  tempo text,
  condicao text
);

create table if not exists public.rdo_mao_obra (
  id uuid default gen_random_uuid() primary key,
  rdo_id uuid references public.rdos(id) on delete cascade not null,
  funcao text not null,
  tipo text not null default 'direta',
  quantidade int not null default 1
);

create table if not exists public.rdo_equipamentos (
  id uuid default gen_random_uuid() primary key,
  rdo_id uuid references public.rdos(id) on delete cascade not null,
  nome text not null,
  quantidade int not null default 1
);

create table if not exists public.rdo_atividades (
  id uuid default gen_random_uuid() primary key,
  rdo_id uuid references public.rdos(id) on delete cascade not null,
  descricao text not null,
  progresso int default 100,
  status_ativ text default 'Concluída',
  ordem int default 0
);

create table if not exists public.rdo_ocorrencias (
  id uuid default gen_random_uuid() primary key,
  rdo_id uuid references public.rdos(id) on delete cascade not null,
  descricao text not null,
  created_at timestamptz default now()
);

create table if not exists public.rdo_comentarios (
  id uuid default gen_random_uuid() primary key,
  rdo_id uuid references public.rdos(id) on delete cascade not null,
  autor text not null,
  texto text not null,
  created_at timestamptz default now()
);

create table if not exists public.rdo_fotos (
  id uuid default gen_random_uuid() primary key,
  rdo_id uuid references public.rdos(id) on delete cascade not null,
  url text not null,
  path text,
  legenda text,
  ordem int default 0,
  created_at timestamptz default now()
);

create table if not exists public.rdo_assinaturas (
  id uuid default gen_random_uuid() primary key,
  rdo_id uuid references public.rdos(id) on delete cascade not null,
  tipo text not null,
  nome text,
  assinatura_url text,
  assinado_em timestamptz
);

-- RLS
alter table public.rdos enable row level security;
alter table public.rdo_clima enable row level security;
alter table public.rdo_mao_obra enable row level security;
alter table public.rdo_equipamentos enable row level security;
alter table public.rdo_atividades enable row level security;
alter table public.rdo_ocorrencias enable row level security;
alter table public.rdo_comentarios enable row level security;
alter table public.rdo_fotos enable row level security;
alter table public.rdo_assinaturas enable row level security;

create policy "auth rdos" on public.rdos for all to authenticated using (true) with check (true);
create policy "auth rdo_clima" on public.rdo_clima for all to authenticated using (true) with check (true);
create policy "auth rdo_mao_obra" on public.rdo_mao_obra for all to authenticated using (true) with check (true);
create policy "auth rdo_equipamentos" on public.rdo_equipamentos for all to authenticated using (true) with check (true);
create policy "auth rdo_atividades" on public.rdo_atividades for all to authenticated using (true) with check (true);
create policy "auth rdo_ocorrencias" on public.rdo_ocorrencias for all to authenticated using (true) with check (true);
create policy "auth rdo_comentarios" on public.rdo_comentarios for all to authenticated using (true) with check (true);
create policy "auth rdo_fotos" on public.rdo_fotos for all to authenticated using (true) with check (true);
create policy "auth rdo_assinaturas" on public.rdo_assinaturas for all to authenticated using (true) with check (true);

-- Storage bucket para fotos do RDO
insert into storage.buckets (id, name, public) values ('rdo-fotos', 'rdo-fotos', true) on conflict do nothing;
create policy "public read rdo fotos" on storage.objects for select using (bucket_id = 'rdo-fotos');
create policy "auth upload rdo fotos" on storage.objects for insert to authenticated with check (bucket_id = 'rdo-fotos');
create policy "auth delete rdo fotos" on storage.objects for delete to authenticated using (bucket_id = 'rdo-fotos');
