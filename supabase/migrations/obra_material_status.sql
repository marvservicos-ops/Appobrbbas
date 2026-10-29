-- ============================================================
-- Status (tags) dos materiais da obra configuráveis.
-- Os status padrão vêm marcados como "sistema" (não podem ser
-- excluídos, mas podem ser renomeados/recoloridos/reordenados);
-- novos status podem ser criados pela tela de materiais.
-- ============================================================

create table if not exists obra_material_status (
  chave text primary key,
  label text not null,
  cor text not null default '#4F7CFF',
  ordem int not null default 0,
  sistema boolean not null default false,
  created_at timestamptz not null default now()
);

insert into obra_material_status (chave, label, cor, ordem, sistema) values
  ('pendente',    'Pendente',    '#475569', 10, true),
  ('orcado',      'Orçado',      '#B45309', 20, true),
  ('comprado',    'Comprado',    '#C2410C', 30, true),
  ('em_transito', 'Em trânsito', '#1D4ED8', 40, true),
  ('recebido',    'Recebido',    '#0F766E', 50, true),
  ('em_obra',     'Em obra',     '#6D28D9', 60, true),
  ('instalado',   'Instalado',   '#047857', 70, true)
on conflict (chave) do nothing;

-- Remove qualquer check constraint antiga que limite obra_materiais.status
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.obra_materiais'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.obra_materiais drop constraint %I', r.conname);
  end loop;
end $$;

alter table obra_material_status enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'obra_material_status' and policyname = 'auth_all') then
    create policy "auth_all" on obra_material_status for all to authenticated using (true) with check (true);
  end if;
end $$;
