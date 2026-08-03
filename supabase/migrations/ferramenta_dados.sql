-- ============================================================
-- Dados técnicos livres em Ferramentas (patrimônio), reaproveitando
-- a mesma biblioteca de campos já usada em Manutenções (campos_tecnicos).
-- ============================================================

create table if not exists ferramenta_dados (
  id uuid primary key default gen_random_uuid(),
  ferramenta_id uuid not null references ferramentas(id) on delete cascade,
  campo_id uuid not null references campos_tecnicos(id) on delete cascade,
  valor text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists ferramenta_dados_ferramenta_idx on ferramenta_dados(ferramenta_id);

alter table ferramenta_dados enable row level security;
create policy "auth_all" on ferramenta_dados for all to authenticated using (true) with check (true);

-- Leitura pública, mesma convenção das demais tabelas de ferramentas
-- (ficha via QR code em /pub/ferramenta/[id]).
create policy "public_select" on ferramenta_dados for select to anon using (true);
