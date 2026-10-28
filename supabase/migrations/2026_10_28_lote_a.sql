-- Lote A (tela da obra): número do RDO único por obra.
-- Com o índice, dois usuários criando "Novo RDO" ao mesmo tempo não geram o mesmo número:
-- o segundo insert recebe erro 23505 e a tela tenta o próximo número.
-- Idempotente. Se já existirem números repetidos na mesma obra, o índice NÃO é criado
-- (aparece um aviso listando quantas obras têm duplicados) — corrija-os e rode de novo.
do $$
declare
  duplicados int;
begin
  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'rdos_obra_numero_unico') then
    return;
  end if;

  select count(*) into duplicados from (
    select obra_id, numero from public.rdos group by obra_id, numero having count(*) > 1
  ) d;

  if duplicados > 0 then
    raise notice 'rdos: % combinação(ões) obra/número repetidas; índice único não criado. Veja: select obra_id, numero, count(*) from rdos group by 1,2 having count(*) > 1;', duplicados;
  else
    create unique index rdos_obra_numero_unico on public.rdos (obra_id, numero);
  end if;
end $$;
