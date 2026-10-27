-- ============================================================
-- Unifica os estoques de material de obra num só, "Materiais de Obra"
--
-- Destino: o estoque "Materiais de Consumo" (renomeado).
-- Origens: "Hidráulico" e "Refrigeração".
-- Produtos, registros (com assinatura, obra e custo), campos
-- customizados e logs passam para o destino; os ids não mudam, então
-- obras, devoluções e estoques de manutenção/mala continuam ligados.
-- Cada produto movido recebe a categoria do estoque de onde veio
-- (Hidráulica / Refrigeração), salvo isolamento, que vai para
-- "Isolamento e vedação". Os estoques de origem ficam desativados
-- (ativo = false), não são apagados.
--
-- Pode rodar de novo sem efeito: só age enquanto as origens estão ativas.
-- ============================================================

alter table public.estoques add column if not exists ativo boolean not null default true;

do $$
declare
  destino uuid;
  origem record;
  cat_origem uuid;
  cat_isolamento uuid;
begin
  select id into destino from estoques
    where nome ilike 'Materiais de Consumo' or nome ilike 'Materiais de Obra'
    order by created_at limit 1;
  if destino is null then
    raise exception 'Estoque "Materiais de Consumo" não encontrado';
  end if;

  update estoques set nome = 'Materiais de Obra' where id = destino and nome ilike 'Materiais de Consumo';

  -- Categoria para cada origem (mesmo nome do estoque) e a de isolamento
  insert into estoque_produto_categorias (estoque_id, nome, cor, ordem)
  select destino, 'Hidráulica', '#10B981', 7
  where not exists (select 1 from estoque_produto_categorias where estoque_id = destino and nome ilike 'Hidráulica');
  insert into estoque_produto_categorias (estoque_id, nome, cor, ordem)
  select destino, 'Refrigeração', '#06B6D4', 4
  where not exists (select 1 from estoque_produto_categorias where estoque_id = destino and nome ilike 'Refrigeração');
  insert into estoque_produto_categorias (estoque_id, nome, cor, ordem)
  select destino, 'Isolamento e vedação', '#F59E0B', 3
  where not exists (select 1 from estoque_produto_categorias where estoque_id = destino and nome ilike 'Isolamento e vedação');
  select id into cat_isolamento from estoque_produto_categorias where estoque_id = destino and nome ilike 'Isolamento e vedação' limit 1;

  for origem in
    select id, nome from estoques
    where id <> destino and ativo and (nome ilike 'Hidráulico' or nome ilike 'Hidraulico' or nome ilike 'Refrigeração' or nome ilike 'Refrigeracao')
  loop
    if exists (select 1 from ferramentas where estoque_id = origem.id) then
      raise exception 'O estoque "%" tem ferramentas cadastradas; não foi unificado', origem.nome;
    end if;

    select id into cat_origem from estoque_produto_categorias
      where estoque_id = destino and nome ilike (case when origem.nome ilike 'Hidr%' then 'Hidráulica' else 'Refrigeração' end)
      limit 1;

    -- Categorias que a origem já tinha: reaproveita a de mesmo nome no destino ou leva junto
    update estoque_produtos p set categoria_id = d.id
      from estoque_produto_categorias o, estoque_produto_categorias d
      where p.categoria_id = o.id and o.estoque_id = origem.id
        and d.estoque_id = destino and lower(trim(d.nome)) = lower(trim(o.nome));
    update obra_previsao_materiais pm set categoria_id = d.id
      from estoque_produto_categorias o, estoque_produto_categorias d
      where pm.categoria_id = o.id and o.estoque_id = origem.id
        and d.estoque_id = destino and lower(trim(d.nome)) = lower(trim(o.nome));
    delete from estoque_produto_categorias o
      where o.estoque_id = origem.id
        and exists (select 1 from estoque_produto_categorias d where d.estoque_id = destino and lower(trim(d.nome)) = lower(trim(o.nome)));
    update estoque_produto_categorias set estoque_id = destino where estoque_id = origem.id;

    -- Campos customizados: de mesmo nome passam a usar o campo do destino; os outros mudam de estoque
    update estoque_registro_valores v set campo_id = d.id
      from estoque_campos o, estoque_campos d
      where v.campo_id = o.id and o.estoque_id = origem.id
        and d.estoque_id = destino and lower(trim(d.nome)) = lower(trim(o.nome));
    delete from estoque_campos o
      where o.estoque_id = origem.id
        and exists (select 1 from estoque_campos d where d.estoque_id = destino and lower(trim(d.nome)) = lower(trim(o.nome)));
    update estoque_campos set estoque_id = destino, ordem = ordem + 100 where estoque_id = origem.id;

    -- Produtos: categoria pela origem (isolamento à parte) quando ainda não têm
    update estoque_produtos set categoria_id = case
        when nome ~* '(armaflex|tubex|isolam|l[ãa] de vidro|fita alum)' then cat_isolamento
        else cat_origem
      end
      where estoque_id = origem.id and categoria_id is null;
    update estoque_produtos set estoque_id = destino where estoque_id = origem.id;

    update estoque_registros set estoque_id = destino where estoque_id = origem.id;
    update estoque_logs set estoque_id = destino where estoque_id = origem.id;

    update estoques set ativo = false,
      descricao = coalesce(descricao || ' · ', '') || 'Unificado em Materiais de Obra'
      where id = origem.id;

    raise notice 'Estoque "%" unificado em Materiais de Obra', origem.nome;
  end loop;
end $$;
