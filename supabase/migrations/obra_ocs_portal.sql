-- ============================================================
-- Ordens de Compra (OCs) dentro da obra + Portal do Cliente
-- ============================================================

-- Ordens de Compra do cliente dentro da obra: substitui o valor único de
-- obra_financeiro como base de cálculo das medições, mantendo compatibilidade
-- com dados existentes (ver backfill abaixo).
create table if not exists obra_ocs (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  numero_oc text not null,
  tipo text not null default 'servico' check (tipo in ('servico', 'material', 'outro')),
  valor_total numeric(14,2) not null default 0 check (valor_total >= 0),
  observacoes text,
  status text not null default 'ativa' check (status in ('ativa', 'concluida')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists obra_ocs_obra_id_idx on obra_ocs(obra_id);

-- Medição passa a poder pertencer a uma OC específica (paralelo a aditivo_id,
-- que continua existindo e funcionando como hoje — são conceitos diferentes)
alter table obra_medicoes add column if not exists oc_id uuid references obra_ocs(id) on delete set null;
create index if not exists obra_medicoes_oc_id_idx on obra_medicoes(oc_id);

-- Acesso do cliente ao portal: token na URL + PIN. Gerar um novo desativa o anterior.
create table if not exists obra_acessos_cliente (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  token text not null unique,
  pin_hash text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index if not exists obra_acessos_cliente_token_idx on obra_acessos_cliente(token) where ativo;

-- Sessão leve pós-PIN, pra não pedir de novo a cada visita
create table if not exists obra_portal_sessoes (
  id uuid primary key default gen_random_uuid(),
  acesso_id uuid not null references obra_acessos_cliente(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

-- RLS: nenhuma política anon nestas tabelas — o portal nunca lê via anon key
-- + RLS. Toda leitura/escrita do portal passa pelas rotas de API que usam
-- um client service-role (lib/supabase/service.ts), que ignora RLS por definição.
alter table obra_ocs enable row level security;
alter table obra_acessos_cliente enable row level security;
alter table obra_portal_sessoes enable row level security;

create policy "auth_all" on obra_ocs for all to authenticated using (true) with check (true);
create policy "auth_all" on obra_acessos_cliente for all to authenticated using (true) with check (true);
-- obra_portal_sessoes: só as rotas de API (service-role) mexem nela, sem policy para authenticated/anon.

-- ============================================================
-- Backfill: obras que já têm obra_financeiro.valor_contrato > 0 ganham uma
-- "OC padrão" com esse valor, e as medições-base (sem aditivo) existentes
-- passam a apontar para ela. Preserva 100% do histórico.
-- ============================================================
do $$
declare r record; nova_oc_id uuid;
begin
  for r in
    select ob.id as obra_id, ob.numero_contrato, f.valor_contrato
    from obras ob
    join obra_financeiro f on f.obra_id = ob.id
    where f.valor_contrato > 0
  loop
    insert into obra_ocs (obra_id, numero_oc, tipo, valor_total)
    values (r.obra_id, coalesce(r.numero_contrato, 'OC-PADRÃO'), 'servico', r.valor_contrato)
    returning id into nova_oc_id;

    update obra_medicoes set oc_id = nova_oc_id
    where obra_id = r.obra_id and aditivo_id is null and oc_id is null;
  end loop;
end $$;
