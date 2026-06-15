-- Adiciona coluna de pasta na tabela documentos
alter table public.documentos add column if not exists pasta text default 'Geral';

-- Tabela de pastas por obra (opcional, para persistir a ordem)
create table if not exists public.doc_pastas (
  id uuid default gen_random_uuid() primary key,
  obra_id uuid references public.obras(id) on delete cascade,
  nome text not null,
  cor text default '#4F7CFF',
  ordem integer default 0,
  created_at timestamptz default now()
);

alter table public.doc_pastas enable row level security;
create policy "auth users" on public.doc_pastas for all to authenticated using (true) with check (true);
