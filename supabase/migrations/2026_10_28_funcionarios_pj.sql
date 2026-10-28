-- ============================================================
-- Lote E (revisão 28/10/2026) — funcionários, uniformes e Gestão PJ
-- RODAR MANUALMENTE DEPOIS DO DEPLOY do código desta revisão:
-- o código novo abre os arquivos do PJ com URL assinada (funciona com o
-- bucket público ou privado), mas o código antigo usa getPublicUrl e
-- pararia de abrir os arquivos quando o bucket ficar privado.
-- Idempotente: pode rodar mais de uma vez.
-- ============================================================

-- ── 1. Gestão PJ: dados e arquivos só para admin ──────────────
-- public.is_admin() já existe (financeiro_admin_schema.sql).

drop policy if exists "auth_all" on public.pj_contratos;
drop policy if exists "admin_all" on public.pj_contratos;
create policy "admin_all" on public.pj_contratos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "auth_all" on public.pj_pagamentos;
drop policy if exists "admin_all" on public.pj_pagamentos;
create policy "admin_all" on public.pj_pagamentos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "auth_all" on public.pj_ferias;
drop policy if exists "admin_all" on public.pj_ferias;
create policy "admin_all" on public.pj_ferias
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Bucket privado: contratos, comprovantes e NFs deixam de abrir sem login
update storage.buckets set public = false where id = 'marv-pj';

drop policy if exists "auth_all_pj" on storage.objects;
drop policy if exists "admin_all_pj" on storage.objects;
create policy "admin_all_pj" on storage.objects
  for all to authenticated
  using (bucket_id = 'marv-pj' and public.is_admin())
  with check (bucket_id = 'marv-pj' and public.is_admin());

-- ── 2. Vínculo do funcionário (CLT / PJ) ──────────────────────
-- Substitui a regra "aba Gestão PJ pelo nome". Enquanto a coluna não existe
-- ou está vazia, o código continua usando a regra do nome.
alter table public.funcionarios add column if not exists tipo_vinculo text;

-- Marca o prestador PJ atual (até aqui identificado pelo nome "João Victor").
-- Confira o resultado: se houver outro "João Victor" CLT, corrija pela tela
-- (Editar funcionário → Vínculo).
update public.funcionarios
   set tipo_vinculo = 'pj'
 where tipo_vinculo is null
   and (lower(nome) like '%joão victor%' or lower(nome) like '%joao victor%');

update public.funcionarios set tipo_vinculo = 'clt' where tipo_vinculo is null;

-- ── 3. Uniformes: excluir categoria/peça não falha por FK ──────
-- (o código já desvincula antes de excluir; isto é a garantia no banco)
alter table public.funcionarios
  drop constraint if exists funcionarios_categoria_uniforme_id_fkey,
  add constraint funcionarios_categoria_uniforme_id_fkey
    foreign key (categoria_uniforme_id) references public.uniforme_categorias(id) on delete set null;

alter table public.estoque_produtos
  drop constraint if exists estoque_produtos_peca_uniforme_id_fkey,
  add constraint estoque_produtos_peca_uniforme_id_fkey
    foreign key (peca_uniforme_id) references public.uniforme_pecas(id) on delete set null;
