-- Reenvio corrigido: combustível (nomes de veículo com coringa %...%)
-- Rodar isto no lugar do bloco de Combustível anterior (que inseriu 0 linhas).

insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-09-11'::date, v.id, 'Gasolina', 25.907, 150.0
from veiculos v where trim(v.nome) ilike '%Corsa%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-09-15'::date, v.id, 'Diesel', 32.311, 200.0
from veiculos v where trim(v.nome) ilike '%Bongo%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-09-15'::date, v.id, 'Gasolina', 40.091, 319.92
from veiculos v where trim(v.nome) ilike '%Civic%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-09-23'::date, v.id, 'Diesel', 32.31, 200.0
from veiculos v where trim(v.nome) ilike '%Amarok%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-09-26'::date, v.id, 'Diesel', 34.84, 200.0
from veiculos v where trim(v.nome) ilike '%Bongo%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-10-01'::date, v.id, 'Diesel', 16.978, 100.0
from veiculos v where trim(v.nome) ilike '%Amarok%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-10-03'::date, v.id, 'Gasolina', 35.77, 285.44
from veiculos v where trim(v.nome) ilike '%Civic%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-10-07'::date, v.id, 'Diesel', 78.343, 461.44
from veiculos v where trim(v.nome) ilike '%Amarok%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-10-10'::date, v.id, 'Diesel', 52.15, 312.38
from veiculos v where trim(v.nome) ilike '%Bongo%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-10-13'::date, v.id, 'Gasolina', 17.463, 150.0
from veiculos v where trim(v.nome) ilike '%Civic%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-10-17'::date, v.id, 'Gasolina', 39.251, 313.22
from veiculos v where trim(v.nome) ilike '%Civic%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-10-22'::date, v.id, 'Gasolina', 17.272, 100.0
from veiculos v where trim(v.nome) ilike '%Corsa%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-10-23'::date, v.id, 'Diesel', 16.155, 100.0
from veiculos v where trim(v.nome) ilike '%Amarok%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-10-30'::date, v.id, 'Diesel', 32.31, 200.0
from veiculos v where trim(v.nome) ilike '%Bongo%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-10-31'::date, v.id, 'Gasolina', 34.89, 278.42
from veiculos v where trim(v.nome) ilike '%Civic%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-11-07'::date, v.id, 'Gasolina', 41.29, 323.49
from veiculos v where trim(v.nome) ilike '%Civic%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-11-11'::date, v.id, 'Diesel', 52.391, 313.82
from veiculos v where trim(v.nome) ilike '%Bongo%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-11-12'::date, v.id, 'Gasolina', 16.978, 100.0
from veiculos v where trim(v.nome) ilike '%Corsa%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-11-15'::date, v.id, 'Gasolina', 46.87, 374.02
from veiculos v where trim(v.nome) ilike '%Civic%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-11-27'::date, v.id, 'Diesel', 32.31, 200.0
from veiculos v where trim(v.nome) ilike '%Bongo%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-12-02'::date, v.id, 'Gasolina', 17.272, 100.0
from veiculos v where trim(v.nome) ilike '%Corsa%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-12-02'::date, v.id, 'Gasolina', 37.88, 302.28
from veiculos v where trim(v.nome) ilike '%Civic%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-12-03'::date, v.id, 'Diesel', 22.762, 150.0
from veiculos v where trim(v.nome) ilike '%Amarok%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-12-03'::date, v.id, 'Diesel', 16.978, 100.0
from veiculos v where trim(v.nome) ilike '%Bongo%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-12-05'::date, v.id, 'Diesel', 15.0, 100.08
from veiculos v where trim(v.nome) ilike '%Bongo%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-12-05'::date, v.id, 'Gasolina', 21.59, 172.29
from veiculos v where trim(v.nome) ilike '%Civic%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-12-08'::date, v.id, 'Diesel', 25.04, 150.0
from veiculos v where trim(v.nome) ilike '%Amarok%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-12-08'::date, v.id, 'Diesel', 25.04, 150.0
from veiculos v where trim(v.nome) ilike '%Amarok%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-01-05'::date, v.id, 'Diesel', 14.51, 100.0
from veiculos v where trim(v.nome) ilike '%Amarok%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-01-21'::date, v.id, 'Gasolina', 11.64, 100.0
from veiculos v where trim(v.nome) ilike '%Civic%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-01-21'::date, v.id, 'Diesel', 37.79, 200.0
from veiculos v where trim(v.nome) ilike '%Amarok%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-01-22'::date, v.id, 'Diesel', 31.79, 200.0
from veiculos v where trim(v.nome) ilike '%Bongo%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-01-26'::date, v.id, 'Gasolina', 16.97, 100.0
from veiculos v where trim(v.nome) ilike '%Corsa%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-01-30'::date, v.id, 'Diesel', 32.84, 200.0
from veiculos v where trim(v.nome) ilike '%Bongo%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-02-09'::date, v.id, 'Gasolina', 47.75, 391.1
from veiculos v where trim(v.nome) ilike '%Civic%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-02-17'::date, v.id, 'Gasolina', 43.7, 347.42
from veiculos v where trim(v.nome) ilike '%Civic%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-02-19'::date, v.id, 'Diesel', 16.15, 100.0
from veiculos v where trim(v.nome) ilike '%Bongo%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-02-24'::date, v.id, 'Diesel', 32.31, 200.0
from veiculos v where trim(v.nome) ilike '%Amarok%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-02-25'::date, v.id, 'Diesel', 30.81, 200.0
from veiculos v where trim(v.nome) ilike '%Bongo%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-02-25'::date, v.id, 'Gasolina', 25.04, 150.0
from veiculos v where trim(v.nome) ilike '%Corsa%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-03-02'::date, v.id, 'Gasolina', 7.95, 50.0
from veiculos v where trim(v.nome) ilike '%Corsa%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-03-02'::date, v.id, 'Diesel', 25.04, 150.0
from veiculos v where trim(v.nome) ilike '%Bongo%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-03-02'::date, v.id, 'Diesel', 31.72, 190.0
from veiculos v where trim(v.nome) ilike '%Amarok%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-03-09'::date, v.id, 'Gasolina', 37.59, 298.84
from veiculos v where trim(v.nome) ilike '%Civic%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-03-13'::date, v.id, 'Diesel', 25.34, 200.0
from veiculos v where trim(v.nome) ilike '%Amarok%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-03-18'::date, v.id, 'Gasolina', 23.28, 200.0
from veiculos v where trim(v.nome) ilike '%Civic%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-03-18'::date, v.id, 'Diesel', 34.69, 238.08
from veiculos v where trim(v.nome) ilike '%Bongo%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-03-18'::date, v.id, 'Diesel', 70.56, 493.21
from veiculos v where trim(v.nome) ilike '%Amarok%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-03-23'::date, v.id, 'Diesel', 12.51, 100.0
from veiculos v where trim(v.nome) ilike '%L200%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-03-24'::date, v.id, 'Gasolina', 15.17, 100.0
from veiculos v where trim(v.nome) ilike '%Civic%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-03-31'::date, v.id, 'Gasolina', 37.09, 296.35
from veiculos v where trim(v.nome) ilike '%Civic%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2029-03-31'::date, v.id, 'Diesel', 28.012, 200.0
from veiculos v where trim(v.nome) ilike '%Bongo%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-04-06'::date, v.id, 'Gasolina', 38.2, 309.04
from veiculos v where trim(v.nome) ilike '%Civic%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-04-06'::date, v.id, 'Gasolina', 13.66, 90.0
from veiculos v where trim(v.nome) ilike '%Corsa%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-04-14'::date, v.id, 'Gasolina', 32.71, 264.62
from veiculos v where trim(v.nome) ilike '%Civic%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-04-28'::date, v.id, 'Gasolina', 40.49, 327.56
from veiculos v where trim(v.nome) ilike '%Civic%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-04-28'::date, v.id, 'Diesel', 13.71, 100.0
from veiculos v where trim(v.nome) ilike '%Amarok%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-04-08'::date, v.id, 'Diesel', 79.25, 569.81
from veiculos v where trim(v.nome) ilike '%Amarok%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-04-15'::date, v.id, 'Diesel', 27.43, 200.0
from veiculos v where trim(v.nome) ilike '%Bongo%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-05-22'::date, v.id, 'Diesel', 29.45, 200.0
from veiculos v where trim(v.nome) ilike '%Bongo%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-05-12'::date, v.id, 'Diesel', 27.43, 200.0
from veiculos v where trim(v.nome) ilike '%Bongo%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-05-07'::date, v.id, 'Gasolina', 29.15, 238.74
from veiculos v where trim(v.nome) ilike '%Civic%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-04-21'::date, v.id, 'Gasolina', 45.6, 368.9
from veiculos v where trim(v.nome) ilike '%Civic%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-04-30'::date, v.id, 'Diesel', 13.7, 100.0
from veiculos v where trim(v.nome) ilike '%Bongo%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2025-11-21'::date, v.id, 'Diesel', 29.0, 200.0
from veiculos v where trim(v.nome) ilike '%Amarok%' limit 1;
insert into esg_combustivel (data, veiculo_id, combustivel, litros, valor)
select '2026-05-22'::date, v.id, 'Diesel', 14.3, 100.0
from veiculos v where trim(v.nome) ilike '%L200%' limit 1;

-- Verificação
select count(*) as total_combustivel from esg_combustivel;
select data, combustivel, litros, valor from esg_combustivel where veiculo_id is null order by data;