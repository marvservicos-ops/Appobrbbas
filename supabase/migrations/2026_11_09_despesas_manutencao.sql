-- ============================================================
-- Despesas diversas também nos contratos de manutenção
-- (estacionamento, pedágio, combustível...). Mesma tabela das despesas
-- da obra: cada despesa é de UMA obra OU de UM contrato de manutenção.
-- Aba "Despesas" do contrato, aberta a todo usuário.
--
-- Depende de 2026_11_06_obra_despesas.sql.
-- RODAR MANUALMENTE no SQL Editor do Supabase. Idempotente.
-- ============================================================

alter table public.obra_despesas
  add column if not exists contrato_manutencao_id uuid references public.contratos_manutencao(id) on delete cascade;

alter table public.obra_despesas alter column obra_id drop not null;

alter table public.obra_despesas drop constraint if exists obra_despesas_um_destino;
alter table public.obra_despesas add constraint obra_despesas_um_destino
  check (num_nonnulls(obra_id, contrato_manutencao_id) = 1);

create index if not exists obra_despesas_contrato_idx
  on public.obra_despesas (contrato_manutencao_id, data desc) where contrato_manutencao_id is not null;
