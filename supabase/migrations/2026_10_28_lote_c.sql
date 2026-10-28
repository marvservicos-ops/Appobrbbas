-- ============================================================
-- Liga o custo administrativo gerado por uma saída de estoque
-- (Limpeza "uso interno" e Copa/Escritório) ao registro que o
-- gerou, para que excluir/editar o registro ajuste o custo junto.
-- O app funciona antes desta migração (grava sem o vínculo e,
-- para registros antigos, acha o custo pela descrição/data/valor).
-- ============================================================

alter table custos_administrativos
  add column if not exists estoque_registro_id uuid references estoque_registros(id) on delete set null;

create index if not exists custos_administrativos_estoque_registro_idx
  on custos_administrativos(estoque_registro_id);
