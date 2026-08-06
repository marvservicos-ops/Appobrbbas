-- ============================================================
-- Configurações da empresa (chave/valor), usada por tributação,
-- adicionais de mão de obra e dados cadastrais da empresa.
-- Tabela já existe em produção (criada fora de migração rastreada);
-- este arquivo só garante o schema para outros ambientes.
-- ============================================================

create table if not exists configuracoes_empresa (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  descricao text,
  valor jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table configuracoes_empresa enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'configuracoes_empresa' and policyname = 'auth_all') then
    create policy "auth_all" on configuracoes_empresa for all to authenticated using (true) with check (true);
  end if;
end $$;
