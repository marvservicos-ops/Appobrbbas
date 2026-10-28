-- Ajuste atômico de saldo: soma/subtrai no próprio banco em vez de o navegador
-- ler o saldo, calcular e regravar (duas pessoas ao mesmo tempo perdiam movimentações).
-- Usado por lib/estoque/saldo.ts (ajustarSaldo). Enquanto esta função não existir,
-- o app cai num caminho antigo que relê o saldo do banco antes de gravar.
-- Roda com as permissões de quem chama (RLS das tabelas continua valendo).

create or replace function public.ajustar_saldo(
  p_tabela text,
  p_id uuid,
  p_delta numeric,
  p_piso_zero boolean default false
)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  novo numeric;
begin
  if p_tabela not in ('estoque_produtos', 'mala_estoque_produtos', 'manutencao_estoque_produtos') then
    raise exception 'Tabela não permitida: %', p_tabela;
  end if;

  execute format(
    'update public.%I set quantidade_atual = case when $3 then greatest(0, round(coalesce(quantidade_atual, 0) + $2, 4)) else round(coalesce(quantidade_atual, 0) + $2, 4) end where id = $1 returning quantidade_atual',
    p_tabela
  ) into novo using p_id, p_delta, p_piso_zero;

  if novo is null then
    raise exception 'Produto não encontrado';
  end if;
  return novo;
end;
$$;

revoke all on function public.ajustar_saldo(text, uuid, numeric, boolean) from public, anon;
grant execute on function public.ajustar_saldo(text, uuid, numeric, boolean) to authenticated;
