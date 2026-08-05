-- ============================================================
-- Rastreabilidade de devolução: liga a entrada de devolução à
-- saída original, permitindo calcular quanto já foi devolvido
-- de cada saída e evitar devolução duplicada além do saldo.
-- ============================================================

alter table estoque_registros add column if not exists registro_origem_id uuid references estoque_registros(id) on delete set null;
create index if not exists estoque_registros_origem_idx on estoque_registros(registro_origem_id);
