'use client'

import { createClient } from '@/lib/supabase/client'
import { sanitizarNomeArquivo } from '@/lib/utils/nomeArquivo'
import { prepararImagem } from '@/lib/utils/imagem'
import { BUCKET_CARTAO, type ComprovanteLido, type Lancamento } from '@/lib/cartao'

export interface ObraOpcao { id: string; titulo: string; status: string | null }
export interface CategoriaOpcao { id: string; nome: string; cor: string }

export const ACEITA_COMPROVANTE = 'image/*,application/pdf,.heic,.heif'

// Sobe o arquivo para o bucket privado. Devolve o path ou lança o erro.
export async function enviarArquivo(file: File, competencia: string): Promise<{ path: string; nome: string; arquivo: File }> {
  const arquivo = await prepararImagem(file)
  const path = `${competencia}/${crypto.randomUUID()}-${sanitizarNomeArquivo(arquivo.name)}`
  const { error } = await createClient().storage.from(BUCKET_CARTAO).upload(path, arquivo, { contentType: arquivo.type || undefined })
  if (error) throw error
  return { path, nome: file.name, arquivo }
}

// Remove o arquivo só se nenhum outro gasto usa o mesmo (parcelas dividem a nota)
export async function removerArquivoSeSobrou(path: string) {
  const sb = createClient()
  const { count } = await sb.from('cartao_comprovantes').select('id', { count: 'exact', head: true }).eq('path', path)
  if (!count) await sb.storage.from(BUCKET_CARTAO).remove([path])
}

export async function abrirArquivo(path: string) {
  // Abre a aba antes do await: Safari bloqueia window.open depois de uma espera
  const aba = window.open('', '_blank')
  const { data, error } = await createClient().storage.from(BUCKET_CARTAO).createSignedUrl(path, 300)
  if (error || !data) { aba?.close(); alert('Não foi possível abrir o comprovante.'); return }
  if (aba) aba.location.href = data.signedUrl
  else window.location.href = data.signedUrl
}

export async function lerComprovante(arquivo: File): Promise<ComprovanteLido | null> {
  const fd = new FormData()
  fd.append('file', arquivo)
  try {
    const res = await fetch('/api/cartao/ler-comprovante', { method: 'POST', body: fd })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// Campos "para onde vai o gasto": obra ou empresa (categoria)
export function CamposDestino({ destino, obraId, categoriaId, obras, categorias, onChange, compacto }: {
  destino: Lancamento['destino']
  obraId: string | null
  categoriaId: string | null
  obras: ObraOpcao[]
  categorias: CategoriaOpcao[]
  onChange: (v: { destino: Lancamento['destino']; obra_id: string | null; categoria_id: string | null }) => void
  compacto?: boolean
}) {
  // Obras em andamento primeiro; concluídas continuam escolhíveis (gasto atrasado)
  const ativas = obras.filter(o => o.status !== 'Concluída')
  const concluidas = obras.filter(o => o.status === 'Concluída')
  return (
    <div className={compacto ? 'flex flex-col sm:flex-row gap-2' : 'space-y-3'}>
      <div className="flex gap-1.5 shrink-0">
        {([['obra', 'Obra'], ['empresa', 'Empresa']] as const).map(([v, label]) => (
          <button key={v} type="button"
            onClick={() => onChange({ destino: v, obra_id: v === 'obra' ? obraId : null, categoria_id: v === 'empresa' ? categoriaId : null })}
            className={`px-3 py-2 rounded-lg text-xs font-medium ${destino === v ? 'bg-[#4F7CFF] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}>
            {label}
          </button>
        ))}
      </div>
      {destino === 'obra' && (
        <select className="field flex-1 min-w-0" value={obraId ?? ''} aria-label="Obra"
          onChange={e => onChange({ destino, obra_id: e.target.value || null, categoria_id: null })}>
          <option value="">Escolha a obra…</option>
          {ativas.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
          {concluidas.length > 0 && (
            <optgroup label="Concluídas">
              {concluidas.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
            </optgroup>
          )}
        </select>
      )}
      {destino === 'empresa' && (
        <select className="field flex-1 min-w-0" value={categoriaId ?? ''} aria-label="Categoria"
          onChange={e => onChange({ destino, obra_id: null, categoria_id: e.target.value || null })}>
          <option value="">Escolha a categoria…</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      )}
    </div>
  )
}
