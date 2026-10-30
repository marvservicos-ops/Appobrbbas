'use client'

// Impressão de uma emissão de documento: uma página por funcionário, ou uma só
// quando o modelo é coletivo (o texto já traz a lista de recebimento).
// ?doc=<id> imprime só o documento de um funcionário (reimpressão pela pasta dele).

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CSS_DOCUMENTO } from '@/lib/documentosFuncionario'
import { PrintCarregando, PrintNaoEncontrado } from '../../Estados'

interface Emitido {
  id: string
  conteudo_html: string
  funcionario: { nome: string } | null
}

interface Emissao {
  id: string
  modelo: { nome: string; versao: string; coletivo: boolean } | null
}

function DocumentoPrint() {
  const { emissaoId } = useParams<{ emissaoId: string }>()
  const docId = useSearchParams().get('doc')
  const [emissao, setEmissao] = useState<Emissao | null>(null)
  const [docs, setDocs] = useState<Emitido[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        let q = supabase.from('doc_emitidos').select('id, conteudo_html, funcionario:funcionario_id(nome)').eq('emissao_id', emissaoId)
        if (docId) q = q.eq('id', docId)
        const [{ data: em }, { data: emitidos }] = await Promise.all([
          supabase.from('doc_emissoes').select('id, modelo:modelo_id(nome, versao, coletivo)').eq('id', emissaoId).single(),
          q,
        ])
        const lista = ((emitidos ?? []) as unknown as Emitido[]).sort((a, b) => (a.funcionario?.nome ?? '').localeCompare(b.funcionario?.nome ?? ''))
        setEmissao(em as unknown as Emissao)
        setDocs(lista)
      } catch (err) {
        console.error('Erro ao carregar documento para impressão', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [emissaoId, docId])

  useEffect(() => {
    if (loading || !emissao || docs.length === 0) return
    const t = setTimeout(() => window.print(), 600)
    return () => clearTimeout(t)
  }, [loading, emissao, docs])

  if (loading) return <PrintCarregando texto="Preparando documento..." />
  if (!emissao || docs.length === 0) return <PrintNaoEncontrado texto="Documento não encontrado." voltarHref="/funcionarios/documentos" voltarTexto="Voltar aos documentos" />

  // Coletivo: todos têm o mesmo texto → imprime uma vez
  const paginas = emissao.modelo?.coletivo ? docs.slice(0, 1) : docs

  return (
    <>
      <style>{`
        @page { size: A4; margin: 18mm 16mm; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .pagina { padding: 0 !important; }
        }
        * { box-sizing: border-box; }
        body { margin: 0; background: white; }
        @media screen { body { padding-top: 56px; } }
        .pagina { max-width: 720px; margin: 0 auto; padding: 32px 8px; }
        .pagina + .pagina { break-before: page; page-break-before: always; }
        ${CSS_DOCUMENTO}
      `}</style>

      <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, zIndex: 100, display: 'flex', gap: 8, alignItems: 'center', fontFamily: 'Arial, sans-serif' }}>
        <span style={{ fontSize: 12, color: '#64748B', background: 'white', padding: '4px 8px', borderRadius: 6 }}>
          {emissao.modelo?.nome} v{emissao.modelo?.versao} · {emissao.modelo?.coletivo ? `lista com ${docs.length}` : `${paginas.length} página${paginas.length === 1 ? '' : 's'}`}
        </span>
        <button onClick={() => window.print()}
          style={{ background: '#4F7CFF', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Imprimir / Salvar PDF
        </button>
      </div>

      <div data-pronto="documento">
        {paginas.map(d => (
          <div key={d.id} className="pagina doc-funcionario" dangerouslySetInnerHTML={{ __html: d.conteudo_html }} />
        ))}
      </div>
    </>
  )
}

export default function DocumentoPrintPage() {
  return <Suspense><DocumentoPrint /></Suspense>
}
