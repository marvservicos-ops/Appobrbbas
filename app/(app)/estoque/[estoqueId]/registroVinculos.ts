import type { SupabaseClient } from '@supabase/supabase-js'
import { EstoqueRegistro } from '@/lib/types'
import { ajustarSaldo } from '@/lib/estoque/saldo'

// Lançamentos gerados junto com uma saída de estoque:
// - destino Manutenção → entrada em manutencao_estoque_registros (origem_estoque_registro_id) + saldo do contrato
// - Limpeza "uso interno" e Copa/Escritório → custo em custos_administrativos
//   (estoque_registro_id, coluna da migração 2026_10_28_lote_c.sql; registros antigos são achados pela descrição)

type Erro = { message: string; code?: string } | null

const OBS_CUSTO_PREFIXO = 'Gerado automaticamente a partir de saída de estoque'

const colunaInexistente = (e: Erro) =>
  !!e && (e.code === '42703' || e.code === 'PGRST204' || /estoque_registro_id/.test(e.message ?? ''))

// Saída com destino Manutenção repõe o estoque local do contrato
export async function reporEstoqueManutencao(sb: SupabaseClient, p: {
  contratoId: string; produtoId: string; qtd: number; responsavel: string; data: string; registroId: string
}): Promise<Erro> {
  const { data: existente, error: errLer } = await sb.from('manutencao_estoque_produtos')
    .select('id').eq('contrato_id', p.contratoId).eq('produto_id', p.produtoId).maybeSingle()
  if (errLer) return errLer
  if (existente) {
    const { error } = await ajustarSaldo(sb, existente.id, p.qtd, { tabela: 'manutencao_estoque_produtos' })
    if (error) return error
  } else {
    const { error } = await sb.from('manutencao_estoque_produtos').insert({ contrato_id: p.contratoId, produto_id: p.produtoId, quantidade_atual: p.qtd })
    if (error) return error
  }
  const { error } = await sb.from('manutencao_estoque_registros').insert({
    contrato_id: p.contratoId, produto_id: p.produtoId, tipo: 'entrada', quantidade: p.qtd,
    responsavel: p.responsavel, data: p.data, origem_estoque_registro_id: p.registroId,
  })
  return error
}

// Busca (ou cria) a categoria administrativa e lança o custo ligado ao registro de estoque
export async function lancarCustoAdministrativo(sb: SupabaseClient, p: {
  categoria: { nome: string; icone: string; cor: string }
  categoriaId?: string | null
  descricao: string; valor: number; data: string; observacao: string; registroId: string
}): Promise<{ categoriaId: string | null; error: Erro }> {
  let categoriaId = p.categoriaId ?? null
  if (!categoriaId) {
    const { data: cat, error: errCat } = await sb.from('categorias_administrativas').select('id').eq('nome', p.categoria.nome).maybeSingle()
    if (errCat) return { categoriaId: null, error: errCat }
    if (cat) categoriaId = cat.id
    else {
      const { data: nova, error: errNova } = await sb.from('categorias_administrativas')
        .insert({ nome: p.categoria.nome, icone: p.categoria.icone, cor: p.categoria.cor }).select('id').single()
      if (errNova) return { categoriaId: null, error: errNova }
      categoriaId = nova.id
    }
  }
  const custo = {
    descricao: p.descricao, categoria_id: categoriaId, valor: p.valor, data: p.data,
    recorrencia: 'unico', ativo: true, observacao: p.observacao,
  }
  let { error } = await sb.from('custos_administrativos').insert({ ...custo, estoque_registro_id: p.registroId })
  // Antes da migração a coluna não existe: grava sem o vínculo
  if (colunaInexistente(error)) ({ error } = await sb.from('custos_administrativos').insert(custo))
  return { categoriaId, error }
}

// Só essas saídas geram custo administrativo (ver registrar/)
export function geraCustoAdministrativo(reg: EstoqueRegistro, estoque: { icone: string; nome: string }): boolean {
  return reg.tipo === 'saida' && reg.destino_tipo === 'uso_interno' && (reg.valor_total ?? 0) > 0
    && (estoque.icone === 'sparkles' || estoque.nome === 'Copa/Escritório')
}

// Acha o custo administrativo gerado pela saída. `id: null` = não foi possível identificar com segurança.
export async function acharCustoVinculado(sb: SupabaseClient, reg: EstoqueRegistro): Promise<{ id: string | null }> {
  const porColuna = await sb.from('custos_administrativos').select('id').eq('estoque_registro_id', reg.id)
  if (!porColuna.error && porColuna.data && porColuna.data.length === 1) return { id: porColuna.data[0].id }
  const temColuna = !colunaInexistente(porColuna.error)

  // Registros antigos (sem vínculo gravado): mesma descrição, data e valor — só se houver exatamente um
  const descricao = `${reg.produto_nome} (${reg.quantidade} ${reg.unidade ?? 'un'})`
  let q = sb.from('custos_administrativos').select('id')
    .eq('descricao', descricao).eq('data', reg.data).eq('valor', reg.valor_total ?? 0)
    .like('observacao', `${OBS_CUSTO_PREFIXO}%`)
  if (temColuna) q = q.is('estoque_registro_id', null)
  const { data, error } = await q
  if (error || !data || data.length !== 1) return { id: null }
  return { id: data[0].id }
}
