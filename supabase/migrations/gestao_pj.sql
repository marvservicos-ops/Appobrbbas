-- ============================================================
-- Gestão PJ (contratos, férias e pagamentos do prestador PJ)
-- ============================================================

create table if not exists pj_contratos (
  id uuid primary key default gen_random_uuid(),
  numero_contrato text,
  data_inicio date not null,
  data_fim date not null,
  valor_mensal numeric(12,2) not null default 0,
  dias_ferias_acumulados integer not null default 15,
  observacao text,
  arquivo_url text,
  created_at timestamptz not null default now()
);

create table if not exists pj_ferias (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid references pj_contratos(id) on delete set null,
  data_inicio date not null,
  data_fim date not null,
  dias integer not null default 0,
  valor_pago numeric(12,2),
  observacao text,
  created_at timestamptz not null default now()
);

create table if not exists pj_pagamentos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid references pj_contratos(id) on delete set null,
  tipo text not null default 'salario' check (tipo in ('salario', 'decimo_terceiro', 'ferias_pagas', 'hora_extra', 'outro')),
  competencia text not null,
  valor numeric(12,2) not null default 0,
  horas_extras numeric,
  observacao text,
  comprovante_url text,
  nota_fiscal_url text,
  created_at timestamptz not null default now()
);

-- Garante todas as colunas mesmo se as tabelas já existiam com outro schema
alter table pj_contratos add column if not exists numero_contrato text;
alter table pj_contratos add column if not exists data_inicio date;
alter table pj_contratos add column if not exists data_fim date;
alter table pj_contratos add column if not exists valor_mensal numeric(12,2) not null default 0;
alter table pj_contratos add column if not exists dias_ferias_acumulados integer not null default 15;
alter table pj_contratos add column if not exists observacao text;
alter table pj_contratos add column if not exists arquivo_url text;

alter table pj_ferias add column if not exists contrato_id uuid references pj_contratos(id) on delete set null;
alter table pj_ferias add column if not exists data_inicio date;
alter table pj_ferias add column if not exists data_fim date;
alter table pj_ferias add column if not exists dias integer not null default 0;
alter table pj_ferias add column if not exists valor_pago numeric(12,2);
alter table pj_ferias add column if not exists observacao text;

alter table pj_pagamentos add column if not exists contrato_id uuid references pj_contratos(id) on delete set null;
alter table pj_pagamentos add column if not exists tipo text not null default 'salario';
alter table pj_pagamentos add column if not exists competencia text;
alter table pj_pagamentos add column if not exists valor numeric(12,2) not null default 0;
alter table pj_pagamentos add column if not exists horas_extras numeric;
alter table pj_pagamentos add column if not exists observacao text;
alter table pj_pagamentos add column if not exists comprovante_url text;
alter table pj_pagamentos add column if not exists nota_fiscal_url text;
alter table pj_pagamentos add column if not exists nota_fiscal_urls text[];

alter table pj_contratos enable row level security;
alter table pj_ferias enable row level security;
alter table pj_pagamentos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'pj_contratos' and policyname = 'auth_all') then
    create policy "auth_all" on pj_contratos for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'pj_ferias' and policyname = 'auth_all') then
    create policy "auth_all" on pj_ferias for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'pj_pagamentos' and policyname = 'auth_all') then
    create policy "auth_all" on pj_pagamentos for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Storage bucket para contratos, comprovantes e notas fiscais
insert into storage.buckets (id, name, public) values ('marv-pj', 'marv-pj', true) on conflict do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'objects' and schemaname = 'storage' and policyname = 'auth_all_pj') then
    create policy "auth_all_pj" on storage.objects for all to authenticated using (bucket_id = 'marv-pj') with check (bucket_id = 'marv-pj');
  end if;
end $$;
