-- ============================================================
-- Categorias de uniforme (ex: "Chão de Fábrica", "Corpo Técnico")
-- e peças de uniforme (Camisa, Calça Jeans, Calça de Brim, Bota...),
-- vinculadas entre si (quais peças cada categoria usa) e ao
-- funcionário (categoria + tamanho/quantidade por peça).
-- Substitui as colunas fixas tamanho_camisa/tamanho_calca/
-- tamanho_calca_brim/tamanho_bota em funcionarios.
-- ============================================================

create table if not exists uniforme_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cor text not null default '#4F7CFF',
  icone text not null default 'Shirt',
  created_at timestamptz not null default now()
);

create table if not exists uniforme_pecas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now()
);

create table if not exists uniforme_categoria_pecas (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references uniforme_categorias(id) on delete cascade,
  peca_id uuid not null references uniforme_pecas(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (categoria_id, peca_id)
);

create table if not exists funcionario_uniforme_tamanhos (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  peca_id uuid not null references uniforme_pecas(id) on delete cascade,
  tamanho text,
  quantidade int not null default 1,
  created_at timestamptz not null default now(),
  unique (funcionario_id, peca_id)
);

alter table public.funcionarios
  add column if not exists categoria_uniforme_id uuid references uniforme_categorias(id);

alter table public.estoque_produtos
  add column if not exists peca_uniforme_id uuid references uniforme_pecas(id);

alter table uniforme_categorias enable row level security;
alter table uniforme_pecas enable row level security;
alter table uniforme_categoria_pecas enable row level security;
alter table funcionario_uniforme_tamanhos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'uniforme_categorias' and policyname = 'auth_all') then
    create policy "auth_all" on uniforme_categorias for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'uniforme_pecas' and policyname = 'auth_all') then
    create policy "auth_all" on uniforme_pecas for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'uniforme_categoria_pecas' and policyname = 'auth_all') then
    create policy "auth_all" on uniforme_categoria_pecas for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'funcionario_uniforme_tamanhos' and policyname = 'auth_all') then
    create policy "auth_all" on funcionario_uniforme_tamanhos for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Seed: categoria "Chão de Fábrica" com as 4 peças hoje existentes,
-- e migração dos dados das colunas antigas de funcionarios.
do $$
declare
  cat_id uuid;
  peca_camisa uuid;
  peca_calca_jeans uuid;
  peca_calca_brim uuid;
  peca_bota uuid;
begin
  select id into cat_id from uniforme_categorias where nome = 'Chão de Fábrica' limit 1;
  if cat_id is null then
    insert into uniforme_categorias (nome, cor, icone) values ('Chão de Fábrica', '#4F7CFF', 'Shirt')
    returning id into cat_id;
  end if;

  select id into peca_camisa from uniforme_pecas where nome = 'Camisa' limit 1;
  if peca_camisa is null then
    insert into uniforme_pecas (nome) values ('Camisa') returning id into peca_camisa;
  end if;

  select id into peca_calca_jeans from uniforme_pecas where nome = 'Calça Jeans' limit 1;
  if peca_calca_jeans is null then
    insert into uniforme_pecas (nome) values ('Calça Jeans') returning id into peca_calca_jeans;
  end if;

  select id into peca_calca_brim from uniforme_pecas where nome = 'Calça de Brim' limit 1;
  if peca_calca_brim is null then
    insert into uniforme_pecas (nome) values ('Calça de Brim') returning id into peca_calca_brim;
  end if;

  select id into peca_bota from uniforme_pecas where nome = 'Bota' limit 1;
  if peca_bota is null then
    insert into uniforme_pecas (nome) values ('Bota') returning id into peca_bota;
  end if;

  insert into uniforme_categoria_pecas (categoria_id, peca_id)
    values (cat_id, peca_camisa), (cat_id, peca_calca_jeans), (cat_id, peca_calca_brim), (cat_id, peca_bota)
  on conflict (categoria_id, peca_id) do nothing;

  update funcionarios set categoria_uniforme_id = cat_id where categoria_uniforme_id is null;

  insert into funcionario_uniforme_tamanhos (funcionario_id, peca_id, tamanho, quantidade)
    select id, peca_camisa, tamanho_camisa, 1 from funcionarios
    where tamanho_camisa is not null and tamanho_camisa <> ''
  on conflict (funcionario_id, peca_id) do nothing;

  insert into funcionario_uniforme_tamanhos (funcionario_id, peca_id, tamanho, quantidade)
    select id, peca_calca_jeans, tamanho_calca, 1 from funcionarios
    where tamanho_calca is not null and tamanho_calca <> ''
  on conflict (funcionario_id, peca_id) do nothing;

  insert into funcionario_uniforme_tamanhos (funcionario_id, peca_id, tamanho, quantidade)
    select id, peca_calca_brim, tamanho_calca_brim, 1 from funcionarios
    where tamanho_calca_brim is not null and tamanho_calca_brim <> ''
  on conflict (funcionario_id, peca_id) do nothing;

  insert into funcionario_uniforme_tamanhos (funcionario_id, peca_id, tamanho, quantidade)
    select id, peca_bota, tamanho_bota, 1 from funcionarios
    where tamanho_bota is not null and tamanho_bota <> ''
  on conflict (funcionario_id, peca_id) do nothing;

  update estoque_produtos set peca_uniforme_id = peca_camisa
    where peca_uniforme_id is null and (lower(nome) like '%camisa%' or lower(nome) like '%jaleco%');
  update estoque_produtos set peca_uniforme_id = peca_bota
    where peca_uniforme_id is null and lower(nome) like '%bota%';
  update estoque_produtos set peca_uniforme_id = peca_calca_brim
    where peca_uniforme_id is null and lower(nome) like '%brim%';
  update estoque_produtos set peca_uniforme_id = peca_calca_jeans
    where peca_uniforme_id is null and (lower(nome) like '%calça%' or lower(nome) like '%calca%');
end $$;
