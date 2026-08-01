-- A migração anterior (obra_medicoes_status_solicitada.sql) chutou o nome da
-- constraint (obra_medicoes_status_check). Se o nome real for outro, aquele
-- DROP não encontrou nada e a constraint antiga (sem 'solicitada') continuou
-- valendo, rejeitando a gravação. Este script encontra e remove QUALQUER
-- check constraint da coluna status em obra_medicoes, pelo nome real, antes
-- de recriar com a lista completa.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'obra_medicoes'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table obra_medicoes drop constraint %I', c.conname);
  end loop;
end $$;

alter table obra_medicoes add constraint obra_medicoes_status_check
  check (status in ('planejada', 'solicitada', 'faturada', 'recebida', 'atrasada', 'cancelada'));
