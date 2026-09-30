-- ============================================================
-- Equipamentos de manutenção: várias fotos por equipamento
-- ============================================================
-- A coluna equipamentos.foto_url continua existindo e passa a guardar a
-- foto de capa (a primeira da galeria), usada pela ficha pública (QR Code).

create table if not exists equipamento_fotos (
  id uuid primary key default gen_random_uuid(),
  equipamento_id uuid not null references equipamentos(id) on delete cascade,
  url text not null,
  path text,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists equipamento_fotos_equipamento_idx on equipamento_fotos(equipamento_id, ordem);

alter table equipamento_fotos enable row level security;
drop policy if exists "auth_all" on equipamento_fotos;
create policy "auth_all" on equipamento_fotos for all to authenticated using (true) with check (true);

-- Traz a foto única que já existia para a galeria
insert into equipamento_fotos (equipamento_id, url, ordem)
select e.id, e.foto_url, 0
from equipamentos e
where e.foto_url is not null
  and not exists (select 1 from equipamento_fotos f where f.equipamento_id = e.id);
