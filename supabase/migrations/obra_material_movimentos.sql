-- ============================================================
-- Movimentações de material da obra (controle por quantidade)
--
-- A linha de obra_materiais continua sendo o que foi comprado
-- (quantidade e valores da NF). Cada movimentação leva parte da
-- quantidade de um status para outro (ex.: 14 de "Recebido" para
-- "Em obra"), então um mesmo item pode estar dividido.
--
-- Distribuição = quantidade toda no de_status da primeira
-- movimentação, mais as movimentações em ordem. Sem movimentações,
-- vale o status da linha como antes. obra_materiais.status passa a
-- guardar o status menos avançado que ainda tem saldo (a tela atualiza).
-- ============================================================

create table if not exists obra_material_movimentos (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references obra_materiais(id) on delete cascade,
  obra_id uuid not null references obras(id) on delete cascade,
  data date not null default current_date,
  quantidade numeric not null check (quantidade > 0),
  de_status text not null,
  para_status text not null,
  responsavel text,
  observacao text,
  created_at timestamptz not null default now(),
  check (de_status <> para_status)
);
create index if not exists obra_material_movimentos_material_idx on obra_material_movimentos(material_id);
create index if not exists obra_material_movimentos_obra_idx on obra_material_movimentos(obra_id);

alter table obra_material_movimentos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'obra_material_movimentos' and policyname = 'auth_all') then
    create policy "auth_all" on obra_material_movimentos for all to authenticated using (true) with check (true);
  end if;
end $$;
