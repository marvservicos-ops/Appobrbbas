-- ============================================================
-- Importação dos dados históricos da planilha "Planilha controles
-- ESG - MARV.xlsx" para as tabelas do módulo ESG.
--
-- Rodar UMA VEZ no Supabase Studio, DEPOIS de aplicar esg.sql.
-- Rodar de novo duplica os registros (não há chave natural/unique
-- aqui — é um import pontual, não uma migração idempotente).
--
-- Combustível: o veículo é resolvido por nome (ilike, ignorando
-- espaços extras) contra a tabela `veiculos` já cadastrada. Se um
-- veículo da planilha não existir com esse nome no banco, a
-- linha ainda é inserida mas com veiculo_id nulo — rode a consulta
-- de verificação no final para achar essas linhas e corrigi-las
-- manualmente (ajustando o nome em `veiculos` ou o veiculo_id do
-- registro).
--
-- ATENÇÃO — inconsistência na planilha original: um abastecimento
-- do Bongo (Diesel, 28.012L, R$200,00) está datado 31/03/2029 na
-- planilha, destoando dos demais lançamentos de março/2026. Mantive
-- a data literal da planilha abaixo — corrija manualmente para
-- 2026-03-31 (ou a data correta) se confirmar que foi erro de
-- digitação.
-- ============================================================

-- ============================================================
-- Importação dos dados históricos da planilha de controle ESG
-- Rodar UMA VEZ no Supabase Studio, após aplicar esg.sql
-- ============================================================

-- Combustível
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-09-11'::date, v.id, 'Gasolina', 25.907, 150.0
from veiculos v where trim(v.nome) ilike 'Corsa' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-09-15'::date, v.id, 'Diesel', 32.311, 200.0
from veiculos v where trim(v.nome) ilike 'Bongo' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-09-15'::date, v.id, 'Gasolina', 40.091, 319.92
from veiculos v where trim(v.nome) ilike 'Civic' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-09-23'::date, v.id, 'Diesel', 32.31, 200.0
from veiculos v where trim(v.nome) ilike 'Amarok' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-09-26'::date, v.id, 'Diesel', 34.84, 200.0
from veiculos v where trim(v.nome) ilike 'Bongo' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-10-01'::date, v.id, 'Diesel', 16.978, 100.0
from veiculos v where trim(v.nome) ilike 'Amarok' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-10-03'::date, v.id, 'Gasolina', 35.77, 285.44
from veiculos v where trim(v.nome) ilike 'Civic' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-10-07'::date, v.id, 'Diesel', 78.343, 461.44
from veiculos v where trim(v.nome) ilike 'Amarok' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-10-10'::date, v.id, 'Diesel', 52.15, 312.38
from veiculos v where trim(v.nome) ilike 'Bongo' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-10-13'::date, v.id, 'Gasolina', 17.463, 150.0
from veiculos v where trim(v.nome) ilike 'Civic' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-10-17'::date, v.id, 'Gasolina', 39.251, 313.22
from veiculos v where trim(v.nome) ilike 'Civic' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-10-22'::date, v.id, 'Gasolina', 17.272, 100.0
from veiculos v where trim(v.nome) ilike 'Corsa' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-10-23'::date, v.id, 'Diesel', 16.155, 100.0
from veiculos v where trim(v.nome) ilike 'Amarok' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-10-30'::date, v.id, 'Diesel', 32.31, 200.0
from veiculos v where trim(v.nome) ilike 'Bongo' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-10-31'::date, v.id, 'Gasolina', 34.89, 278.42
from veiculos v where trim(v.nome) ilike 'Civic' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-11-07'::date, v.id, 'Gasolina', 41.29, 323.49
from veiculos v where trim(v.nome) ilike 'Civic' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-11-11'::date, v.id, 'Diesel', 52.391, 313.82
from veiculos v where trim(v.nome) ilike 'Bongo' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-11-12'::date, v.id, 'Gasolina', 16.978, 100.0
from veiculos v where trim(v.nome) ilike 'Corsa' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-11-15'::date, v.id, 'Gasolina', 46.87, 374.02
from veiculos v where trim(v.nome) ilike 'Civic' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-11-27'::date, v.id, 'Diesel', 32.31, 200.0
from veiculos v where trim(v.nome) ilike 'Bongo' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-12-02'::date, v.id, 'Gasolina', 17.272, 100.0
from veiculos v where trim(v.nome) ilike 'Corsa' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-12-02'::date, v.id, 'Gasolina', 37.88, 302.28
from veiculos v where trim(v.nome) ilike 'Civic' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-12-03'::date, v.id, 'Diesel', 22.762, 150.0
from veiculos v where trim(v.nome) ilike 'Amarok' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-12-03'::date, v.id, 'Diesel', 16.978, 100.0
from veiculos v where trim(v.nome) ilike 'Bongo' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-12-05'::date, v.id, 'Diesel', 15.0, 100.08
from veiculos v where trim(v.nome) ilike 'Bongo' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-12-05'::date, v.id, 'Gasolina', 21.59, 172.29
from veiculos v where trim(v.nome) ilike 'Civic' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-12-08'::date, v.id, 'Diesel', 25.04, 150.0
from veiculos v where trim(v.nome) ilike 'Amarok' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-12-08'::date, v.id, 'Diesel', 25.04, 150.0
from veiculos v where trim(v.nome) ilike 'Amarok' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-01-05'::date, v.id, 'Diesel', 14.51, 100.0
from veiculos v where trim(v.nome) ilike 'Amarok' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-01-21'::date, v.id, 'Gasolina', 11.64, 100.0
from veiculos v where trim(v.nome) ilike 'Civic' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-01-21'::date, v.id, 'Diesel', 37.79, 200.0
from veiculos v where trim(v.nome) ilike 'Amarok' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-01-22'::date, v.id, 'Diesel', 31.79, 200.0
from veiculos v where trim(v.nome) ilike 'Bongo' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-01-26'::date, v.id, 'Gasolina', 16.97, 100.0
from veiculos v where trim(v.nome) ilike 'Corsa' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-01-30'::date, v.id, 'Diesel', 32.84, 200.0
from veiculos v where trim(v.nome) ilike 'Bongo' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-02-09'::date, v.id, 'Gasolina', 47.75, 391.1
from veiculos v where trim(v.nome) ilike 'Civic' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-02-17'::date, v.id, 'Gasolina', 43.7, 347.42
from veiculos v where trim(v.nome) ilike 'Civic' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-02-19'::date, v.id, 'Diesel', 16.15, 100.0
from veiculos v where trim(v.nome) ilike 'Bongo' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-02-24'::date, v.id, 'Diesel', 32.31, 200.0
from veiculos v where trim(v.nome) ilike 'Amarok' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-02-25'::date, v.id, 'Diesel', 30.81, 200.0
from veiculos v where trim(v.nome) ilike 'Bongo' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-02-25'::date, v.id, 'Gasolina', 25.04, 150.0
from veiculos v where trim(v.nome) ilike 'Corsa' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-03-02'::date, v.id, 'Gasolina', 7.95, 50.0
from veiculos v where trim(v.nome) ilike 'Corsa' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-03-02'::date, v.id, 'Diesel', 25.04, 150.0
from veiculos v where trim(v.nome) ilike 'Bongo' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-03-02'::date, v.id, 'Diesel', 31.72, 190.0
from veiculos v where trim(v.nome) ilike 'Amarok' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-03-09'::date, v.id, 'Gasolina', 37.59, 298.84
from veiculos v where trim(v.nome) ilike 'Civic' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-03-13'::date, v.id, 'Diesel', 25.34, 200.0
from veiculos v where trim(v.nome) ilike 'Amarok' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-03-18'::date, v.id, 'Gasolina', 23.28, 200.0
from veiculos v where trim(v.nome) ilike 'Civic' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-03-18'::date, v.id, 'Diesel', 34.69, 238.08
from veiculos v where trim(v.nome) ilike 'Bongo' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-03-18'::date, v.id, 'Diesel', 70.56, 493.21
from veiculos v where trim(v.nome) ilike 'Amarok' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-03-23'::date, v.id, 'Diesel', 12.51, 100.0
from veiculos v where trim(v.nome) ilike 'L200' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-03-24'::date, v.id, 'Gasolina', 15.17, 100.0
from veiculos v where trim(v.nome) ilike 'Civic' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-03-31'::date, v.id, 'Gasolina', 37.09, 296.35
from veiculos v where trim(v.nome) ilike 'Civic' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2029-03-31'::date, v.id, 'Diesel', 28.012, 200.0
from veiculos v where trim(v.nome) ilike 'Bongo' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-04-06'::date, v.id, 'Gasolina', 38.2, 309.04
from veiculos v where trim(v.nome) ilike 'Civic' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-04-06'::date, v.id, 'Gasolina', 13.66, 90.0
from veiculos v where trim(v.nome) ilike 'Corsa' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-04-14'::date, v.id, 'Gasolina', 32.71, 264.62
from veiculos v where trim(v.nome) ilike 'Civic' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-04-28'::date, v.id, 'Gasolina', 40.49, 327.56
from veiculos v where trim(v.nome) ilike 'Civic' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-04-28'::date, v.id, 'Diesel', 13.71, 100.0
from veiculos v where trim(v.nome) ilike 'Amarok' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-04-08'::date, v.id, 'Diesel', 79.25, 569.81
from veiculos v where trim(v.nome) ilike 'Amarok' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-04-15'::date, v.id, 'Diesel', 27.43, 200.0
from veiculos v where trim(v.nome) ilike 'Bongo' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-05-22'::date, v.id, 'Diesel', 29.45, 200.0
from veiculos v where trim(v.nome) ilike 'Bongo' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-05-12'::date, v.id, 'Diesel', 27.43, 200.0
from veiculos v where trim(v.nome) ilike 'Bongo' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-05-07'::date, v.id, 'Gasolina', 29.15, 238.74
from veiculos v where trim(v.nome) ilike 'Civic' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-04-21'::date, v.id, 'Gasolina', 45.6, 368.9
from veiculos v where trim(v.nome) ilike 'Civic' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-04-30'::date, v.id, 'Diesel', 13.7, 100.0
from veiculos v where trim(v.nome) ilike 'Bongo' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-11-21'::date, v.id, 'Diesel', 29.0, 200.0
from veiculos v where trim(v.nome) ilike 'Amarok' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-05-22'::date, v.id, 'Diesel', 14.3, 100.0
from veiculos v where trim(v.nome) ilike 'L200' limit 1;

-- Investimentos (Melhorias)
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2025-09-19'::date, 'Cilindro para gás recolhedora 50L', 'Ambiental', 3.0, 2175.0);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2025-09-19'::date, 'Parafusadeira a Bateria 20V', 'Ferramental', 1.0, 225.0);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2025-09-19'::date, 'Lavadora Portatil de alta pressão a bateria', 'Ferramental', 1.0, 280.71);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2025-09-22'::date, 'Recolhedora recicladora Pro 1HP', 'Ambiental', 1.0, 4510.71);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2025-08-19'::date, 'Alicate de corte 6 EIOS', 'Ferramental', 1.0, 21.25);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2025-08-19'::date, 'KIT 6 Chaves de Fenda', 'Ferramental', 1.0, 46.21);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2025-10-16'::date, 'Trena Curta 5M', 'Ferramental', 1.0, 12.9);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2025-10-16'::date, 'Trena de bolso 5M', 'Ferramental', 1.0, 29.01);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2025-10-16'::date, 'Estilete Profissional 6', 'Ferramental', 2.0, 33.8);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2025-11-05'::date, 'Ventilador de Parede Ventisol 1M', 'Social', 3.0, 2187.0);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2025-11-07'::date, 'Adequação do banheiro Térreo para PCD', 'Social', 1.0, 1716.45);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2025-11-05'::date, 'EPI Obramax', 'SST', 1.0, 1439.08);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2025-11-05'::date, 'Cinta Catraca e Lona', 'Ferramental', 2.0, 264.8);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2025-11-17'::date, 'Mascaras EPI', 'SST', 20.0, 90.0);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2025-11-25'::date, 'EPI Obramax', 'SST', 10.0, 451.7);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-03-17'::date, 'Mascara Respirador PFF2', 'SST', 22.0, 50.16);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-03-17'::date, 'Luva de Segurança', 'SST', 12.0, 46.68);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-03-17'::date, 'Protetor Auricular', 'SST', 52.0, 141.88);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-03-18'::date, 'Chave fendas', 'Ferramental', 1.0, 9.59);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-03-18'::date, 'Chave Combinada Catraca 13mm', 'Ferramental', 2.0, 48.58);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-03-18'::date, 'Alicate universal', 'Ferramental', 1.0, 34.9);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-03-18'::date, 'Formão chanfrado', 'Ferramental', 1.0, 52.71);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-03-18'::date, 'Chave fendas simples', 'Ferramental', 1.0, 6.9);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-03-18'::date, 'Rebitador manual', 'Ferramental', 1.0, 70.41);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-03-18'::date, 'chave catraca reversível', 'Ferramental', 1.0, 57.9);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-03-18'::date, 'Talhadeira sextavada', 'Ferramental', 1.0, 21.69);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-03-18'::date, 'Chave combinada Catraca 10mm', 'Ferramental', 2.0, 41.18);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-03-02'::date, 'Capacete de segurança', 'SST', 3.0, 110.7);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-03-02'::date, 'Estilete Profissional 6', 'Ferramental', 2.0, 34.02);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-03-02'::date, 'Respirador semifacial', 'SST', 2.0, 89.12);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-03-02'::date, 'Oculos de seguraça', 'SST', 3.0, 119.7);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-03-02'::date, 'Cinto ergonomico', 'SST', 5.0, 229.5);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-03-02'::date, 'Carneira plastica', 'SST', 10.0, 56.9);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-03-05'::date, 'Estilete Profissional 6', 'Ferramental', 3.0, 51.03);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-03-27'::date, 'Abafador de ruídos', 'SST', 3.0, 113.73);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-03-27'::date, 'Jogo de ponteiras', 'Ferramental', 1.0, 29.9);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-03-27'::date, 'Respirador semifacial', 'SST', 1.0, 44.7);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-03-27'::date, 'Cartucho p/ respirador', 'SST', 2.0, 23.8);
insert into esg_investimentos (data, item, categoria, quantidade, valor) values ('2026-02-19'::date, 'Mala - kit primeiros socorros', 'SST', 11.0, 96.39);

-- Destinação dos Materiais
insert into esg_destinacao_materiais (data, cliente, material, quantidade, valor) values ('2025-09-25'::date, 'Globo Participações', 'Ferro', 269.0, 215.2);
insert into esg_destinacao_materiais (data, cliente, material, quantidade, valor) values ('2025-10-09'::date, 'Globo Participações', 'Aço', 4.3, 25.8);
insert into esg_destinacao_materiais (data, cliente, material, quantidade, valor) values ('2025-10-09'::date, 'Globo Participações', 'Cobre', 39.8, 1393);
insert into esg_destinacao_materiais (data, cliente, material, quantidade, valor) values ('2025-10-09'::date, 'Globo Participações', 'Ferro', 6.3, 5.04);
insert into esg_destinacao_materiais (data, cliente, material, quantidade, valor) values ('2025-10-01'::date, 'Globo Participações', 'Ferro', 230.0, 184);
insert into esg_destinacao_materiais (data, cliente, material, quantidade, valor) values ('2025-11-21'::date, 'Globo Participações', 'Ferro', 1364.0, 1091.2);
insert into esg_destinacao_materiais (data, cliente, material, quantidade, valor) values ('2025-11-25'::date, 'Globo Participações', 'Ferro', 550.0, 440);
insert into esg_destinacao_materiais (data, cliente, material, quantidade, valor) values ('2026-03-30'::date, 'Globo Participações', 'Ferro', 233.0, null);
insert into esg_destinacao_materiais (data, cliente, material, quantidade, valor) values ('2026-03-30'::date, 'Globo Participações', 'Papelão', 67.0, null);
insert into esg_destinacao_materiais (data, cliente, material, quantidade, valor) values ('2026-02-26'::date, 'Globo Participações', 'Ferro', 159.0, null);
insert into esg_destinacao_materiais (data, cliente, material, quantidade, valor) values ('2026-02-26'::date, 'Globo Participações', 'Alumínio', 32.9, null);
insert into esg_destinacao_materiais (data, cliente, material, quantidade, valor) values ('2026-02-26'::date, 'Globo Participações', 'Papelão', 16.0, null);
insert into esg_destinacao_materiais (data, cliente, material, quantidade, valor) values ('2026-02-26'::date, 'Globo Participações', 'Metal', 2.6, null);
insert into esg_destinacao_materiais (data, cliente, material, quantidade, valor) values ('2026-01-22'::date, 'Globo Participações', 'Ferro', 190.0, null);
insert into esg_destinacao_materiais (data, cliente, material, quantidade, valor) values ('2026-01-22'::date, 'Globo Participações', 'Papelão', 30.0, null);
insert into esg_destinacao_materiais (data, cliente, material, quantidade, valor) values ('2026-01-22'::date, 'Globo Participações', 'Alumínio', 16.6, null);
insert into esg_destinacao_materiais (data, cliente, material, quantidade, valor) values ('2026-01-22'::date, 'Globo participações', 'Ferro', 40.0, null);
insert into esg_destinacao_materiais (data, cliente, material, quantidade, valor) values ('2026-01-22'::date, 'Globo participações', 'Alumínio', 47.1, null);
insert into esg_destinacao_materiais (data, cliente, material, quantidade, valor) values ('2026-04-28'::date, 'Globo participações', 'Papelão', 19.0, null);
insert into esg_destinacao_materiais (data, cliente, material, quantidade, valor) values ('2026-05-19'::date, 'Globo participações', 'Metal', 1.0, null);
insert into esg_destinacao_materiais (data, cliente, material, quantidade, valor) values ('2026-05-19'::date, 'Globo participações', 'Cobre', 1.6, null);
insert into esg_destinacao_materiais (data, cliente, material, quantidade, valor) values ('2026-05-19'::date, 'Globo participações', 'Ferro', 456.0, null);
insert into esg_destinacao_materiais (data, cliente, material, quantidade, valor) values ('2026-05-19'::date, 'Globo participações', 'Materiais diversos', 21.0, null);

-- Reciclagem de Gás
insert into esg_reciclagem_gas (data, empresa_emissora, tipo_gas, quantidade, valor_recebido)
select '2025-10-31'::date, 'Globo Comunicação e Participações', 'R-410A', 24.2, 290.4;
insert into esg_reciclagem_gas (data, empresa_emissora, tipo_gas, quantidade, valor_recebido)
select '2025-10-31'::date, 'Kongsberg Maritime do Brasil', 'R-410A', 1.2, 14.4;
insert into esg_reciclagem_gas (data, empresa_emissora, tipo_gas, quantidade, valor_recebido)
select '2025-10-31'::date, 'Baltimore Fundo de Investimento Imob.', 'R-407-C', 27.8, 139;
insert into esg_reciclagem_gas (data, empresa_emissora, tipo_gas, quantidade, valor_recebido)
select '2025-11-07'::date, 'Globo Comunicação e Participações', 'R-410A', 11.1, 133.2;
-- ============================================================
-- Verificação pós-import
-- ============================================================
select count(*) as total_combustivel from esg_combustivel;
select count(*) as total_investimentos from esg_investimentos;
select count(*) as total_destinacao from esg_destinacao_materiais;
select count(*) as total_gas from esg_reciclagem_gas;

-- Abastecimentos sem veículo resolvido (nome não encontrado em `veiculos`)
select data, combustivel, litros, valor
from esg_combustivel
where veiculo_id is null
order by data;
