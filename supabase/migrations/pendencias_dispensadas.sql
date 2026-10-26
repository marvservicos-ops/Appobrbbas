-- ============================================================
-- Pendências marcadas como "está ok" no painel do Dashboard.
-- Guarda a "chave" (impressão do estado) no momento da dispensa: se o
-- estado mudar (ex.: chegou RDO novo e depois parou de novo), a
-- pendência volta a aparecer. Também filtra o e-mail diário.
-- ============================================================

create table if not exists pendencias_dispensadas (
  pendencia_id text primary key,
  chave text not null,
  titulo text,
  dispensado_por uuid references auth.users(id) on delete set null,
  dispensado_por_nome text,
  created_at timestamptz not null default now()
);

alter table pendencias_dispensadas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'pendencias_dispensadas' and policyname = 'auth_all') then
    create policy "auth_all" on pendencias_dispensadas for all to authenticated using (true) with check (true);
  end if;
end $$;
