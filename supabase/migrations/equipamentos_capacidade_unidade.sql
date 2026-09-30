-- ============================================================
-- Equipamentos de manutenção: unidade da capacidade livre
-- ============================================================
-- A capacidade não é sempre em BTU (ex.: bomba em CV/HP, chiller em TR).
-- capacidade_btu passa a guardar só o valor (aceitando decimais, ex. 7,5 CV)
-- e capacidade_unidade guarda a unidade digitada pelo usuário.

alter table equipamentos alter column capacidade_btu type numeric using capacidade_btu::numeric;
alter table equipamentos add column if not exists capacidade_unidade text;

-- Tudo o que já estava cadastrado era em BTU
update equipamentos set capacidade_unidade = 'BTU'
where capacidade_btu is not null and capacidade_unidade is null;
