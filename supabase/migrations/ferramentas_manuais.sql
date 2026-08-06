-- ============================================================
-- Separa "Ferramentas Manuais" (chave de fenda, chave inglesa etc,
-- hoje vivendo dentro de malas) de "Ferramentas" (maquinário:
-- parafusadeira, furadeira, martelete...). São SKUs, fluxo de
-- empréstimo e catalogação diferentes.
--
-- Cria a nova categoria de estoque (ícone 'hammer') e migra pra lá
-- as malas existentes e suas ferramentas-filha, que hoje ficam
-- dentro da(s) categoria(s) "Ferramentas" (ícone 'wrench').
-- ============================================================

do $$
declare
  nova_estoque_id uuid;
  origem record;
begin
  -- Cria a categoria só se ainda não existir uma com esse nome
  select id into nova_estoque_id from estoques where nome = 'Ferramentas Manuais' limit 1;
  if nova_estoque_id is null then
    insert into estoques (nome, icone, cor)
    values ('Ferramentas Manuais', 'hammer', '#F97316')
    returning id into nova_estoque_id;
  end if;

  -- Move toda mala (eh_mala = true) que hoje está numa categoria "wrench",
  -- e junto move as ferramentas-filha dela (mala_id apontando pra ela)
  for origem in
    select f.id from ferramentas f
    join estoques e on e.id = f.estoque_id
    where e.icone = 'wrench' and f.eh_mala = true
  loop
    update ferramentas set estoque_id = nova_estoque_id where id = origem.id;
    update ferramentas set estoque_id = nova_estoque_id where mala_id = origem.id;
  end loop;
end $$;
