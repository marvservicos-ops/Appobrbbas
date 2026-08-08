-- ============================================================
-- Backup completo do Diário de Obra (não só as obras vinculadas)
-- ============================================================
-- diario_obra_relatorios passa a ser indexado pela obra EXTERNA (do
-- Diário de Obra), não pela obra do marv-gestão — permite fazer backup
-- de todas as obras do Diário de Obra (inclusive as que não existem
-- aqui) numa varredura só. obra_id continua preenchido quando existe
-- uma obra correspondente aqui, só pra exibir a lista dentro da obra.

alter table diario_obra_relatorios alter column obra_id drop not null;
alter table diario_obra_relatorios add column if not exists diario_obra_id_externo text;
alter table diario_obra_relatorios add column if not exists diario_obra_nome text;

update diario_obra_relatorios r
set diario_obra_id_externo = o.diario_obra_id
from obras o
where r.obra_id = o.id and r.diario_obra_id_externo is null;

alter table diario_obra_relatorios alter column diario_obra_id_externo set not null;

alter table diario_obra_relatorios drop constraint if exists diario_obra_relatorios_obra_id_diario_relatorio_id_key;
alter table diario_obra_relatorios drop constraint if exists diario_obra_relatorios_externo_key;
alter table diario_obra_relatorios add constraint diario_obra_relatorios_externo_key unique (diario_obra_id_externo, diario_relatorio_id);
