-- ============================================================
-- Reconcilia o "Nº OC" de materiais (texto livre em obra_materiais)
-- com a tabela obra_ocs (mesma unidade usada pelas medições de serviço
-- e pelo portal do cliente).
-- ============================================================

alter table obra_materiais add column if not exists oc_id uuid references obra_ocs(id) on delete set null;
alter table obra_notas_material add column if not exists oc_id uuid references obra_ocs(id) on delete set null;
create index if not exists obra_materiais_oc_id_idx on obra_materiais(oc_id);

-- ============================================================
-- Backfill 1: para cada (obra_id, numero_oc) já usado em obra_materiais,
-- casa com uma obra_ocs existente do mesmo número, ou cria uma nova
-- (tipo 'material', valor_total = soma do valor_venda_total do grupo,
-- já que não existe hoje um total explícito declarado para OC de material).
-- ============================================================
do $$
declare r record; oc_existente uuid; nova_oc_id uuid;
begin
  for r in
    select obra_id, numero_oc, sum(coalesce(valor_venda_total, 0)) as total_venda
    from obra_materiais
    where numero_oc is not null and trim(numero_oc) <> '' and oc_id is null
    group by obra_id, numero_oc
  loop
    select id into oc_existente from obra_ocs
      where obra_id = r.obra_id and numero_oc = r.numero_oc
      limit 1;

    if oc_existente is null then
      insert into obra_ocs (obra_id, numero_oc, tipo, valor_total)
      values (r.obra_id, r.numero_oc, 'material', r.total_venda)
      returning id into oc_existente;
    end if;

    update obra_materiais set oc_id = oc_existente
      where obra_id = r.obra_id and numero_oc = r.numero_oc and oc_id is null;
  end loop;
end $$;

-- ============================================================
-- Backfill 2 (melhor esforço): tenta recuperar o oc_id de medições de
-- material já geradas (obra_medicoes com observacoes = 'medicao_material'),
-- via obra_notas_material.itens_ids -> obra_materiais.oc_id, quando todos
-- os itens da nota pertencem à mesma OC. Roda em bloco protegido: se o
-- formato de itens_ids for diferente do esperado (uuid[]), não interrompe
-- a migração — só pula esta etapa.
-- ============================================================
do $$
declare r record; oc_unica uuid; qtd_ocs int;
begin
  for r in
    select nm.id as nota_id, nm.medicao_id, nm.itens_ids
    from obra_notas_material nm
    where nm.medicao_id is not null and nm.oc_id is null and nm.itens_ids is not null
  loop
    select count(distinct om.oc_id), min(om.oc_id) into qtd_ocs, oc_unica
      from obra_materiais om
      where om.id = any(r.itens_ids) and om.oc_id is not null;

    if qtd_ocs = 1 then
      update obra_notas_material set oc_id = oc_unica where id = r.nota_id;
      update obra_medicoes set oc_id = oc_unica where id = r.medicao_id and oc_id is null;
    end if;
  end loop;
exception when others then
  raise notice 'Backfill 2 (medições de material) pulado — formato de itens_ids inesperado: %', sqlerrm;
end $$;
