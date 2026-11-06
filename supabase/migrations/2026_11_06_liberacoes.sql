-- ============================================================
-- Solicitações de liberação de acesso (funcionários e/ou veículos)
-- para obras cadastradas ou locais avulsos. Os dados de cada pessoa
-- e veículo ficam gravados na própria solicitação (do jeito que foram
-- enviados), mas tudo continua editável e reenviável.
-- RODAR MANUALMENTE no SQL Editor do Supabase. Idempotente.
-- ============================================================

create table if not exists public.liberacoes (
  id uuid primary key default gen_random_uuid(),
  -- obra cadastrada (opcional); sem obra, vale local_nome/local_endereco
  obra_id uuid references public.obras(id) on delete set null,
  local_nome text not null default '',
  local_endereco text,
  local_cliente text,
  data_inicio date not null,
  data_fim date not null,
  horario text,
  -- [{chave, funcionario_id, nome, cpf, funcao}]
  funcionarios jsonb not null default '[]'::jsonb,
  -- [{chave, veiculo_id, nome, placa, cor, motoristas: [{funcionario_id, nome, cpf}]}]
  veiculos jsonb not null default '[]'::jsonb,
  destinatarios text[] not null default '{}',
  cc text[] not null default '{}',
  assunto text not null default '',
  mensagem text not null default '',
  status text not null default 'rascunho' check (status in ('rascunho', 'enviada')),
  envios int not null default 0,
  enviada_em timestamptz,
  enviada_por_nome text,
  resend_id text,
  criado_por uuid default auth.uid(),
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint liberacoes_periodo_ok check (data_fim >= data_inicio)
);
create index if not exists liberacoes_obra_idx on public.liberacoes (obra_id);
create index if not exists liberacoes_inicio_idx on public.liberacoes (data_inicio desc);

-- Só admin: a solicitação tem CPF dos funcionários
alter table public.liberacoes enable row level security;
drop policy if exists "admin_all" on public.liberacoes;
create policy "admin_all" on public.liberacoes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
