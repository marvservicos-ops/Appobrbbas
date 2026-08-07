-- ============================================================
-- Integração com a API do app "Diário de Obra"
-- ============================================================
-- Os RDOs completos (fotos, atividades etc.) NÃO são replicados no
-- banco — o PDF de cada relatório é baixado da API externa e salvo no
-- Google Drive. Aqui guardamos só o vínculo obra <-> Diário de Obra e
-- um índice leve dos relatórios já importados (evita reimportar e
-- permite listar/linkar o PDF dentro da tela da obra).

alter table obras add column if not exists diario_obra_id text;

create table if not exists diario_obra_relatorios (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  diario_relatorio_id text not null,
  numero int,
  data date,
  status_descricao text,
  drive_file_id text,
  drive_file_url text,
  importado_em timestamptz not null default now(),
  unique (obra_id, diario_relatorio_id)
);

alter table diario_obra_relatorios enable row level security;
create policy "auth_all" on diario_obra_relatorios for all to authenticated using (true) with check (true);
