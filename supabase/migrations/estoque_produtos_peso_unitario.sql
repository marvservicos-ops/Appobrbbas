-- Peso de 1 peça (em gramas), para lançar entrada/saída/devolução pela balança:
-- quantidade = peso pesado ÷ peso_unitario_g.
alter table public.estoque_produtos
  add column if not exists peso_unitario_g numeric;
