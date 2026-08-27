-- ============================================================
-- Diário de Obra: detectar edições feitas no app externo
-- ============================================================
-- Guarda uma "impressão digital" do estado do relatório na última
-- importação (updatedAt / revisão / status). Quando ela muda, a
-- sincronização re-baixa o PDF (substituindo o arquivo no Drive) e
-- atualiza o status no banco, em vez de ignorar o relatório por já existir.

alter table diario_obra_relatorios add column if not exists atualizado_em text;
