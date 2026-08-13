-- ============================================================
-- Modelos reutilizáveis de Permissão de Trabalho (PT): guarda os
-- checklists (agentes da fatalidade, riscos, precauções, EPI) já
-- marcados para atividades recorrentes (ex: "PT de Solda",
-- "PT de Hidráulica"), pra aplicar de uma vez num documento novo.
-- ============================================================

create table if not exists pt_modelos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  dados jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table pt_modelos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'pt_modelos' and policyname = 'auth_all') then
    create policy "auth_all" on pt_modelos for all to authenticated using (true) with check (true);
  end if;
end $$;
