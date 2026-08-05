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
  nota_fiscal_urls text[],
  created_at timestamptz not null default now()
);

alter table pj_contratos enable row level security;
alter table pj_ferias enable row level security;
alter table pj_pagamentos enable row level security;
create policy "auth_all" on pj_contratos for all to authenticated using (true) with check (true);
create policy "auth_all" on pj_ferias for all to authenticated using (true) with check (true);
create policy "auth_all" on pj_pagamentos for all to authenticated using (true) with check (true);

-- Storage bucket para contratos, comprovantes e notas fiscais
insert into storage.buckets (id, name, public) values ('marv-pj', 'marv-pj', true) on conflict do nothing;
create policy "auth_all_pj" on storage.objects for all to authenticated using (bucket_id = 'marv-pj') with check (bucket_id = 'marv-pj');
