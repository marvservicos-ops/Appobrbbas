-- ============================================================
-- Histórico dos e-mails enviados a partir dos modelos (ex.: Pesquisa de
-- Satisfação) em cada obra. Os envios saem pelo Resend, não pela caixa
-- do Gmail do usuário, então sem esse registro não há como saber no app
-- o que já foi enviado nem se chegou ao destinatário.
-- ============================================================

create table if not exists obra_emails_enviados (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  template_id text,
  template_nome text,
  destinatario text not null,
  assunto text not null,
  remetente text,
  resend_id text,
  -- Último evento informado pelo Resend: sent, delivered, bounced, opened...
  status text not null default 'sent',
  enviado_por uuid references auth.users(id) on delete set null,
  enviado_por_nome text,
  created_at timestamptz not null default now()
);

create index if not exists obra_emails_enviados_obra_idx on obra_emails_enviados (obra_id, created_at desc);

alter table obra_emails_enviados enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'obra_emails_enviados' and policyname = 'auth_all') then
    create policy "auth_all" on obra_emails_enviados for all to authenticated using (true) with check (true);
  end if;
end $$;
