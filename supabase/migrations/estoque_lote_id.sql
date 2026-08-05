-- ============================================================
-- Agrupamento de saídas de EPI/uniforme entregues juntas ao mesmo
-- funcionário no mesmo momento, para gerar um único termo de
-- responsabilidade cobrindo vários itens (ex.: luva + máscara).
-- ============================================================

alter table estoque_registros add column if not exists lote_id uuid;
create index if not exists estoque_registros_lote_id_idx on estoque_registros(lote_id);
