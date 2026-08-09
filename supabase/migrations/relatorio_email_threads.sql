-- ============================================================
-- Rastreia a thread de e-mail de cada série de relatório (por obra +
-- tipo), pra que o próximo envio responda o e-mail anterior em vez de
-- abrir uma conversa nova toda vez.
-- ============================================================

create table if not exists relatorio_email_threads (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  tipo text not null default 'rdo',
  ultimo_message_id text,
  updated_at timestamptz not null default now(),
  unique (obra_id, tipo)
);

alter table relatorio_email_threads enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'relatorio_email_threads' and policyname = 'auth_all') then
    create policy "auth_all" on relatorio_email_threads for all to authenticated using (true) with check (true);
  end if;
end $$;
