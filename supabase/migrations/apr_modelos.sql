-- ============================================================
-- Modelos reutilizáveis de Análise Preliminar de Risco (APR): guarda a
-- tabela de riscos e observações já preenchidas para atividades
-- recorrentes (ex: "APR de Trabalho em Altura"), pra aplicar de uma vez
-- num documento novo. Espelha pt_modelos.
-- ============================================================

create table if not exists apr_modelos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  dados jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table apr_modelos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'apr_modelos' and policyname = 'auth_all') then
    create policy "auth_all" on apr_modelos for all to authenticated using (true) with check (true);
  end if;
end $$;
