-- Relatórios do contrato de manutenção vindos do Diário de Obra.
-- Cada tipo de relatório (ex.: "Preventiva Unidades Internas", "Chiller Hitachi")
-- é uma obra própria no Diário de Obra; os PDFs são importados para
-- diario_obra_relatorios pela mesma sincronização das obras (por diario_obra_id_externo).

create table if not exists contrato_relatorio_tipos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references contratos_manutencao(id) on delete cascade,
  nome text not null,
  diario_obra_id text not null,
  periodicidade text not null default 'mensal'
    check (periodicidade in ('mensal', 'bimestral', 'trimestral', 'semestral', 'anual')),
  -- 'aaaa-mm' do primeiro mês devido (só importa fora do mensal); vazio = início do contrato
  mes_inicio text,
  ativo boolean not null default true,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists contrato_relatorio_tipos_contrato_idx on contrato_relatorio_tipos (contrato_id);
alter table contrato_relatorio_tipos enable row level security;
drop policy if exists "auth_all" on contrato_relatorio_tipos;
create policy "auth_all" on contrato_relatorio_tipos for all to authenticated using (true) with check (true);

-- Conversa de e-mail por contrato (os relatórios de cada mês respondem o anterior)
alter table relatorio_email_threads alter column obra_id drop not null;
alter table relatorio_email_threads add column if not exists contrato_id uuid references contratos_manutencao(id) on delete cascade;
create unique index if not exists relatorio_email_threads_contrato_tipo_key on relatorio_email_threads (contrato_id, tipo);
