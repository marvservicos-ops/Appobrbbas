-- ============================================================
-- Clientes: novo tipo "Fiscal" (além de Gestor e Comprador)
-- ============================================================
-- A tabela `clientes` foi criada fora dos arquivos versionados. Se a
-- coluna `tipo` tiver um CHECK restringindo os valores, rode o bloco
-- abaixo para liberar 'Fiscal'. Se não houver constraint (coluna text
-- livre), nada precisa ser feito — o app já grava 'Fiscal' direto.

do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'public.clientes'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%tipo%';

  if con_name is not null then
    execute format('alter table public.clientes drop constraint %I', con_name);
  end if;

  alter table public.clientes
    add constraint clientes_tipo_check
    check (tipo is null or tipo in ('Gestor', 'Comprador', 'Fiscal'));
end $$;
