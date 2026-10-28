-- ============================================================
-- Segurança (revisão 28/10/2026) — lote H
-- Idempotente. Rodar manualmente no SQL Editor DEPOIS do deploy do código.
-- Requer public.is_admin() e public.has_permission(text) (financeiro_admin_schema.sql).
-- ============================================================

-- ── 1. Portal do cliente: obra_acessos_cliente ──────────────────
-- Token + hash do PIN. Antes qualquer logado lia/criava/trocava acessos pelo
-- navegador e entrava no portal. Agora sem policy para authenticated/anon:
-- só as rotas de API com service role mexem nela
--   /api/portal/gerar-acesso (GET/POST, exige permissão "financeiro")
--   /api/portal/[token]/verify e a página /portal/[token] (servidor).
drop policy if exists "auth_all" on obra_acessos_cliente;
alter table obra_acessos_cliente enable row level security;

-- ── 2. Ordens de Compra: obra_ocs ───────────────────────────────
-- Leitura continua para todos os logados: a aba Materiais da obra (aberta a
-- todos) lista as OCs no SeletorOC e o Centro de Custos faz join com a OC.
-- Inserir também continua liberado: o SeletorOC da aba Materiais cria OC "na hora".
-- Alterar e excluir (valor da OC, que é a base das medições) só financeiro/admin.
drop policy if exists "auth_all" on obra_ocs;
drop policy if exists "obra_ocs_select" on obra_ocs;
drop policy if exists "obra_ocs_insert" on obra_ocs;
drop policy if exists "obra_ocs_update" on obra_ocs;
drop policy if exists "obra_ocs_delete" on obra_ocs;
create policy "obra_ocs_select" on obra_ocs for select to authenticated using (true);
create policy "obra_ocs_insert" on obra_ocs for insert to authenticated with check (true);
create policy "obra_ocs_update" on obra_ocs for update to authenticated
  using (public.has_permission('financeiro') or public.is_admin())
  with check (public.has_permission('financeiro') or public.is_admin());
create policy "obra_ocs_delete" on obra_ocs for delete to authenticated
  using (public.has_permission('financeiro') or public.is_admin());

-- ── 3. Configurações da empresa ─────────────────────────────────
-- Alíquota do Simples, adicionais de mão de obra e dados cadastrais:
-- todos os logados leem (usado em custos, fichas e relatórios); só admin grava.
drop policy if exists "auth_all" on configuracoes_empresa;
drop policy if exists "configuracoes_empresa_select" on configuracoes_empresa;
drop policy if exists "configuracoes_empresa_admin_insert" on configuracoes_empresa;
drop policy if exists "configuracoes_empresa_admin_update" on configuracoes_empresa;
drop policy if exists "configuracoes_empresa_admin_delete" on configuracoes_empresa;
create policy "configuracoes_empresa_select" on configuracoes_empresa for select to authenticated using (true);
create policy "configuracoes_empresa_admin_insert" on configuracoes_empresa for insert to authenticated with check (public.is_admin());
create policy "configuracoes_empresa_admin_update" on configuracoes_empresa for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "configuracoes_empresa_admin_delete" on configuracoes_empresa for delete to authenticated using (public.is_admin());
