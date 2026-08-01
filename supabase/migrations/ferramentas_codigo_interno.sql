-- Identificação interna obrigatória para distinguir ativos idênticos (ex: 2 furadeiras iguais)
alter table ferramentas add column if not exists codigo_interno text;
create unique index if not exists ferramentas_codigo_interno_estoque_idx
  on ferramentas(estoque_id, codigo_interno) where codigo_interno is not null;
