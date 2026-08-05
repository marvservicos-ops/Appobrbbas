-- ============================================================
-- Notas de padaria (Café) — lançamento em lote em custos_administrativos
-- Categoria 'Café' já existe (criada manualmente); resolvida por nome.
-- ============================================================

insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês 1,6kg', c.id, 18.4, '2026-06-25'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Queijo mussarela, presunto e pão francês', c.id, 15.84, '2026-06-22'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês e açúcar União', c.id, 18.98, '2026-06-23'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês e mortadela defumada', c.id, 45.77, '2026-06-24'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês 1kg', c.id, 11.5, '2026-06-26'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Presunto, pão francês, bolo, leite Piracanjuba e queijo prato', c.id, 31.61, '2026-06-27'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Queijo prato, presunto, pão francês, bolo e pacote de cavaca', c.id, 22.07, '2026-06-28'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês 1,53kg', c.id, 17.6, '2026-06-29'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês e mortadela defumada', c.id, 37.65, '2026-06-30'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês 1,375kg', c.id, 15.81, '2026-07-07'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês 1,365kg', c.id, 15.7, '2026-07-03'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês e mortadela defumada', c.id, 35.64, '2026-07-06'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês 1,36kg', c.id, 15.64, '2026-07-06'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês 1,34kg', c.id, 15.41, '2026-07-11'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Mortadela defumada e pão francês', c.id, 31.64, '2026-07-11'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês 1,3kg', c.id, 14.95, '2026-07-16'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês 1,2kg', c.id, 13.8, '2026-07-13'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês 1,3kg', c.id, 14.95, '2026-07-16'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês 1,2kg', c.id, 13.8, '2026-07-16'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês e açúcar União', c.id, 20.3, '2026-07-17'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês e mortadela defumada', c.id, 33.8, '2026-07-20'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês e Qualy 500g (desconto R$0,50)', c.id, 25.8, '2026-07-21'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês, Qualy 500g e açúcar União (desconto R$0,50)', c.id, 32.3, '2026-07-23'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês 1,2kg', c.id, 13.8, '2026-07-24'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Qualy 500g, açúcar União e pão francês', c.id, 33.2, '2026-07-27'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês (0,64kg + 0,65kg)', c.id, 14.84, '2026-07-29'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês 0,67kg', c.id, 7.7, '2026-07-30'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês 0,68kg', c.id, 7.82, '2026-07-28'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;
insert into custos_administrativos (descricao, categoria_id, valor, data, recorrencia, ativo)
select 'Pão francês, açúcar União e Qualy 500g', c.id, 26.48, '2026-07-31'::date, 'unico', true
from categorias_administrativas c where trim(c.nome) ilike 'café' limit 1;

-- Total: 29 notas, R$ 622.80

-- Verificação: quantas notas realmente foram inseridas (deve ser 29)
-- Se a categoria 'Café' não existir com esse nome exato, os inserts acima
-- rodam sem erro mas não inserem nada — confira o count abaixo.
-- Verificação
select count(*) as total_lancado, sum(valor) as valor_total
from custos_administrativos where categoria_id = (select id from categorias_administrativas where nome = 'Café') and recorrencia = 'unico';