-- ============================================================
-- Guarda destinatário(s) e cópia do último e-mail de relatório de cada
-- obra, pra pré-preencher automaticamente no próximo envio.
-- ============================================================

alter table relatorio_email_threads add column if not exists ultimo_destinatarios text[];
alter table relatorio_email_threads add column if not exists ultimo_cc text[];
