import type { SupabaseClient } from '@supabase/supabase-js'
import { hojeLocal } from '@/lib/datas'
import { mensagemErro } from '@/lib/erros'

// Registra a devolução de um ou mais itens de empréstimo e volta as ferramentas
// para "disponível". Usado na devolução individual e na devolução em lote.
// Devolve a mensagem de erro (em português) ou null.
export async function devolverItens(
  sb: SupabaseClient,
  itens: { id: string; ferramenta_id: string }[],
  observacoes?: string | null,
): Promise<string | null> {
  if (itens.length === 0) return null
  const { error: itemErr } = await sb.from('ferramenta_emprestimo_itens').update({
    data_devolucao: hojeLocal(),
    observacoes_devolucao: observacoes?.trim() || null,
  }).in('id', itens.map(i => i.id)).is('data_devolucao', null)
  if (itemErr) return mensagemErro(itemErr, 'Erro ao registrar devolução')

  // Só mexe em quem ainda está como emprestada (não desfaz uma baixa, por exemplo)
  const { error: ferrErr } = await sb.from('ferramentas').update({ status: 'disponivel' })
    .in('id', Array.from(new Set(itens.map(i => i.ferramenta_id)))).eq('status', 'emprestada')
  if (ferrErr) return mensagemErro(ferrErr, 'Devolução registrada, mas o status da ferramenta não foi atualizado')
  return null
}

// Abre a aba ainda no clique (o Safari do iPhone bloqueia window.open depois de await).
// Devolve a aba (ou null, se bloqueada) para receber o endereço depois.
export function abrirAbaVazia(): Window | null {
  try { return window.open('', '_blank') } catch { return null }
}
