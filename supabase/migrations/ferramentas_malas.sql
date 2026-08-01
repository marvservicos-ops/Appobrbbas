-- Malas de ferramenta: kits com responsável fixo (não passam pelo fluxo de empréstimo/contrato)
alter table ferramentas add column if not exists eh_mala boolean not null default false;
alter table ferramentas add column if not exists mala_id uuid references ferramentas(id) on delete set null;
alter table ferramentas add column if not exists responsavel_atual_id uuid references funcionarios(id);

create index if not exists ferramentas_mala_id_idx on ferramentas(mala_id);
create index if not exists ferramentas_responsavel_atual_idx on ferramentas(responsavel_atual_id);
