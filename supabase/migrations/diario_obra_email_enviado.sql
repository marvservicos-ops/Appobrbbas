-- ============================================================
-- Registra, por RDO do Diário de Obra, se e quando foi enviado por e-mail
-- (antes só havia a data do último envio da obra inteira).
-- ============================================================

alter table diario_obra_relatorios add column if not exists email_enviado_em timestamptz;
alter table diario_obra_relatorios add column if not exists email_enviado_para text[];
alter table diario_obra_relatorios add column if not exists email_enviado_por text;

-- Retroativo (aproximado): RDOs importados antes do último envio da obra
-- são considerados enviados nessa data.
update diario_obra_relatorios r
   set email_enviado_em = t.updated_at,
       email_enviado_para = t.ultimo_destinatarios
  from relatorio_email_threads t
 where t.obra_id = r.obra_id
   and t.tipo = 'rdo'
   and r.email_enviado_em is null
   and r.importado_em <= t.updated_at;
