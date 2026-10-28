import { NextRequest, NextResponse } from 'next/server'
import { sincronizarProjetoDiario } from '@/lib/diarioObra'
import { exigirUsuarioAtivo } from '@/lib/apiAuth'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Importa do Diário de Obra os relatórios de todos os tipos ativos do contrato
export async function POST(req: NextRequest) {
  const auth = await exigirUsuarioAtivo()
  if (!auth.ok) return auth.resposta

  const { contratoId } = await req.json()
  if (!contratoId) return NextResponse.json({ error: 'contratoId é obrigatório' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: tipos, error } = await supabase
    .from('contrato_relatorio_tipos')
    .select('id, nome, diario_obra_id')
    .eq('contrato_id', contratoId)
    .eq('ativo', true)
  if (error) {
    console.error('[manutencao/relatorios/sincronizar] erro ao ler tipos', error)
    return NextResponse.json({ error: 'Não foi possível ler os relatórios do contrato.' }, { status: 500 })
  }
  if (!tipos || tipos.length === 0) {
    return NextResponse.json({ error: 'Cadastre ao menos um tipo de relatório vinculado ao Diário de Obra.' }, { status: 400 })
  }

  // Projetos repetidos (dois tipos no mesmo projeto) sincronizam uma vez só
  const projetos = Array.from(new Set(tipos.map(t => t.diario_obra_id)))
  const orcamento = Math.max(5, Math.floor(30 / projetos.length))
  let importados = 0, atualizados = 0, removidos = 0, pendente = false
  const erros: string[] = []

  for (const projeto of projetos) {
    const nome = tipos.find(t => t.diario_obra_id === projeto)?.nome ?? projeto
    try {
      const r = await sincronizarProjetoDiario(projeto, orcamento)
      importados += r.importados; atualizados += r.atualizados; removidos += r.removidos
      pendente = pendente || r.pendente
      erros.push(...r.erros.map(e => `${nome}: ${e}`))
    } catch (e) {
      console.error('[manutencao/relatorios/sincronizar]', projeto, e)
      erros.push(`${nome}: não foi possível sincronizar com o Diário de Obra.`)
    }
  }

  return NextResponse.json({ ok: true, importados, atualizados, removidos, pendente, erros })
}
