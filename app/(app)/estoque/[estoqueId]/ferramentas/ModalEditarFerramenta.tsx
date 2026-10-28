'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { X, Loader2, Upload, Wrench, Building2, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { converterSeForHeic } from '@/lib/utils/heic'
import { validarPdf } from '@/lib/utils/pdf'
import { sanitizarNomeArquivo } from '@/lib/utils/nomeArquivo'
import { mensagemErro } from '@/lib/erros'
import { parseNumeroBR } from '@/lib/numero'
import { Ferramenta } from '@/lib/types'

export default function ModalEditarFerramenta({ ferramenta, modoPatrimonio = false, onClose, onSaved }: {
  ferramenta: Ferramenta; modoPatrimonio?: boolean; onClose: () => void; onSaved: () => void
}) {
  const [nome, setNome] = useState(ferramenta.nome)
  const [codigoInterno, setCodigoInterno] = useState(ferramenta.codigo_interno ?? '')
  const [ehMala, setEhMala] = useState(ferramenta.eh_mala)
  const [malaId, setMalaId] = useState(ferramenta.mala_id ?? '')
  const [malas, setMalas] = useState<{ id: string; nome: string; codigo_interno: string | null }[]>([])
  const [categoria, setCategoria] = useState(ferramenta.categoria ?? '')
  const [marca, setMarca] = useState(ferramenta.marca ?? '')
  const [modelo, setModelo] = useState(ferramenta.modelo ?? '')
  const [numeroSerie, setNumeroSerie] = useState(ferramenta.numero_serie ?? '')
  const [valorAquisicao, setValorAquisicao] = useState(ferramenta.valor_aquisicao != null ? String(ferramenta.valor_aquisicao).replace('.', ',') : '')
  const [dataAquisicao, setDataAquisicao] = useState(ferramenta.data_aquisicao ?? '')
  const [observacoes, setObservacoes] = useState(ferramenta.observacoes ?? '')
  const [fotoUrl, setFotoUrl] = useState(ferramenta.foto_url ?? '')
  const [fotoUrl2, setFotoUrl2] = useState(ferramenta.foto_url_2 ?? '')
  const [manualUrl, setManualUrl] = useState(ferramenta.manual_url ?? '')
  const [manualNome, setManualNome] = useState(ferramenta.manual_nome ?? '')
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [uploadingFoto2, setUploadingFoto2] = useState(false)
  const [uploadingManual, setUploadingManual] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Mala com itens dentro: desmarcar "É uma mala" exige soltar os itens (viram avulsos)
  const [qtdFilhos, setQtdFilhos] = useState(0)
  const [qtdMateriais, setQtdMateriais] = useState(0)
  const [soltarFilhos, setSoltarFilhos] = useState(false)
  // Emprestada: não pode mudar de mala nem virar mala até ser devolvida
  const travaPertencimento = ferramenta.status === 'emprestada'

  useEffect(() => {
    async function carregarMalas() {
      const supabase = createClient()
      const { data } = await supabase.from('ferramentas').select('id, nome, codigo_interno')
        .eq('estoque_id', ferramenta.estoque_id).eq('eh_mala', true).neq('id', ferramenta.id).order('nome')
      setMalas(data ?? [])
    }
    async function contarConteudo() {
      const supabase = createClient()
      const [{ count: filhos }, { count: materiais }] = await Promise.all([
        supabase.from('ferramentas').select('id', { count: 'exact', head: true }).eq('mala_id', ferramenta.id),
        supabase.from('mala_estoque_produtos').select('id', { count: 'exact', head: true }).eq('mala_id', ferramenta.id),
      ])
      setQtdFilhos(filhos ?? 0)
      setQtdMateriais(materiais ?? 0)
    }
    carregarMalas()
    if (ferramenta.eh_mala) contarConteudo()
  }, [ferramenta.estoque_id, ferramenta.id, ferramenta.eh_mala])

  function alternarEhMala(marcar: boolean) {
    if (!marcar && ferramenta.eh_mala) {
      if (qtdMateriais > 0) {
        setError(`Esta mala tem ${qtdMateriais} ${qtdMateriais === 1 ? 'material de uso cadastrado' : 'materiais de uso cadastrados'}. Remova-os da mala antes de desmarcar.`)
        return
      }
      if (qtdFilhos > 0) {
        if (!confirm(`Esta mala tem ${qtdFilhos} ${qtdFilhos === 1 ? 'item' : 'itens'} dentro. Ao salvar, ${qtdFilhos === 1 ? 'ele vira ferramenta avulsa' : 'eles viram ferramentas avulsas'}. Continuar?`)) return
        setSoltarFilhos(true)
      }
    }
    if (marcar) setSoltarFilhos(false)
    setError('')
    setEhMala(marcar)
    if (marcar) setMalaId('')
  }

  // Envia para o storage e devolve a URL pública; em caso de erro mostra a mensagem e devolve null
  async function enviarArquivo(file: File, prefixo = ''): Promise<string | null> {
    const supabase = createClient()
    const path = `ferramentas/${ferramenta.estoque_id}/${prefixo}${Date.now()}_${sanitizarNomeArquivo(file.name)}`
    const { error: err } = await supabase.storage.from('estoque').upload(path, file, { upsert: true })
    if (err) { setError(mensagemErro(err, 'Erro ao enviar arquivo')); return null }
    return supabase.storage.from('estoque').getPublicUrl(path).data.publicUrl
  }

  async function uploadFoto(fileOriginal: File) {
    setUploadingFoto(true)
    setError('')
    try {
      const url = await enviarArquivo(await converterSeForHeic(fileOriginal))
      if (url) setFotoUrl(url)
    } catch (e) {
      setError(mensagemErro(e as Error, 'Erro ao enviar foto'))
    } finally {
      setUploadingFoto(false)
    }
  }

  async function uploadFoto2(fileOriginal: File) {
    setUploadingFoto2(true)
    setError('')
    try {
      const url = await enviarArquivo(await converterSeForHeic(fileOriginal))
      if (url) setFotoUrl2(url)
    } catch (e) {
      setError(mensagemErro(e as Error, 'Erro ao enviar foto'))
    } finally {
      setUploadingFoto2(false)
    }
  }

  async function uploadManual(file: File) {
    const erro = validarPdf(file)
    if (erro) { setError(erro); return }
    setUploadingManual(true)
    setError('')
    try {
      const url = await enviarArquivo(file, 'manual_')
      if (url) {
        setManualUrl(url)
        setManualNome(file.name)
      }
    } catch (e) {
      setError(mensagemErro(e as Error, 'Erro ao enviar manual'))
    } finally {
      setUploadingManual(false)
    }
  }

  const enviando = uploadingFoto || uploadingFoto2 || uploadingManual

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    if (!codigoInterno.trim()) { setError('Informe o código interno/patrimônio.'); return }
    if (enviando) { setError('Aguarde o envio dos arquivos terminar.'); return }
    const valorNum = valorAquisicao.trim() ? parseNumeroBR(valorAquisicao) : null
    if (valorNum != null && (Number.isNaN(valorNum) || valorNum < 0)) { setError('Valor de aquisição inválido.'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()
    if (!ehMala && ferramenta.eh_mala && soltarFilhos) {
      const { error: errFilhos } = await supabase.from('ferramentas').update({ mala_id: null }).eq('mala_id', ferramenta.id)
      if (errFilhos) { setError(mensagemErro(errFilhos, 'Erro ao soltar os itens da mala')); setLoading(false); return }
    }
    const { error: err } = await supabase.from('ferramentas').update({
      nome: nome.trim(),
      codigo_interno: codigoInterno.trim(),
      categoria: categoria.trim() || null,
      marca: marca.trim() || null,
      modelo: modelo.trim() || null,
      numero_serie: numeroSerie.trim() || null,
      valor_aquisicao: valorNum,
      data_aquisicao: dataAquisicao || null,
      observacoes: observacoes.trim() || null,
      foto_url: fotoUrl || null,
      foto_url_2: fotoUrl2 || null,
      manual_url: manualUrl || null,
      manual_nome: manualNome || null,
      ...(travaPertencimento ? {} : { eh_mala: ehMala, mala_id: !ehMala && malaId ? malaId : null }),
      updated_at: new Date().toISOString(),
    }).eq('id', ferramenta.id)
    if (err) {
      setError(err.code === '23505' ? 'Já existe uma ferramenta com esse código interno nesta categoria.' : mensagemErro(err, 'Erro ao salvar'))
      setLoading(false)
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md max-h-[calc(100dvh-env(safe-area-inset-top))] overflow-y-auto mt-auto sm:mt-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-syne font-semibold text-[#0F172A]">{modoPatrimonio ? 'Editar Item de Patrimônio' : 'Editar Ferramenta'}</h2>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 -m-2 rounded-lg hover:bg-[#F1F5F9]"><X size={16} className="text-[#64748B]" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Nome *</label>
            <input required autoFocus className="field" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Furadeira de Impacto" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Código interno / Patrimônio *</label>
            <input required className="field font-mono" value={codigoInterno} onChange={e => setCodigoInterno(e.target.value)} placeholder="Ex: FER-0001" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Categoria</label>
              <input className="field" value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Ex: Elétrica" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Nº de série</label>
              <input className="field" value={numeroSerie} onChange={e => setNumeroSerie(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Marca</label>
              <input className="field" value={marca} onChange={e => setMarca(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Modelo</label>
              <input className="field" value={modelo} onChange={e => setModelo(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Valor de aquisição (R$)</label>
              <input type="text" inputMode="decimal" className="field" placeholder="0,00" value={valorAquisicao} onChange={e => setValorAquisicao(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Data de aquisição</label>
              <input type="date" className="field" value={dataAquisicao} onChange={e => setDataAquisicao(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Observações</label>
            <input className="field" value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional" />
          </div>

          {!modoPatrimonio && (
            <label className={`flex items-center gap-2 text-sm text-[#374151] px-3 py-2.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] ${travaPertencimento ? 'opacity-60' : 'cursor-pointer'}`}>
              <input type="checkbox" checked={ehMala} disabled={travaPertencimento} onChange={e => alternarEhMala(e.target.checked)} className="rounded" />
              É uma mala de ferramentas (kit com responsável fixo)
              {ferramenta.eh_mala && qtdFilhos > 0 && <span className="ml-auto text-xs text-[#94A3B8] whitespace-nowrap">{qtdFilhos} {qtdFilhos === 1 ? 'item' : 'itens'} dentro</span>}
            </label>
          )}
          {soltarFilhos && !ehMala && (
            <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">Ao salvar, os {qtdFilhos} itens desta mala viram ferramentas avulsas.</p>
          )}
          {travaPertencimento && !modoPatrimonio && (
            <p className="text-xs text-[#64748B]">Ferramenta emprestada: registre a devolução antes de mudar mala ou pertencimento.</p>
          )}
          {!ehMala && !modoPatrimonio && malas.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Pertence a uma mala?</label>
              <select className="field" value={malaId} disabled={travaPertencimento} onChange={e => setMalaId(e.target.value)}>
                <option value="">Nenhuma (ferramenta avulsa)</option>
                {malas.map(m => <option key={m.id} value={m.id}>{m.nome}{m.codigo_interno ? ` (${m.codigo_interno})` : ''}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">{modoPatrimonio ? 'Foto 1' : 'Foto'}</label>
            <div className="flex items-center gap-3">
              {fotoUrl
                ? <Image src={fotoUrl} alt="foto" width={64} height={64} className="w-16 h-16 rounded-lg object-cover border border-[#E2E8F0]" />
                : <div className="w-16 h-16 rounded-lg bg-[#F1F5F9] flex items-center justify-center border border-dashed border-[#CBD5E1]">
                    {modoPatrimonio ? <Building2 size={20} className="text-[#94A3B8]" /> : <Wrench size={20} className="text-[#94A3B8]" />}
                  </div>}
              <label className="flex-1 cursor-pointer flex items-center gap-2 px-3 py-2 border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] text-sm text-[#64748B] transition-colors">
                {uploadingFoto ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploadingFoto ? 'Enviando...' : fotoUrl ? 'Trocar foto' : 'Adicionar foto'}
                <input type="file" accept="image/*,.heic,.heif" className="hidden" disabled={uploadingFoto}
                  onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadFoto(f) }} />
              </label>
              {fotoUrl && (
                <button type="button" onClick={() => setFotoUrl('')} aria-label="Remover foto" title="Remover foto" className="p-2 text-[#94A3B8] hover:text-red-500 transition-colors">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
          {modoPatrimonio && (
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Foto 2 (opcional)</label>
              <p className="text-xs text-[#94A3B8] mb-1.5">Ex: evaporadora + condensadora de um ar-condicionado</p>
              <div className="flex items-center gap-3">
                {fotoUrl2
                  ? <Image src={fotoUrl2} alt="foto 2" width={64} height={64} className="w-16 h-16 rounded-lg object-cover border border-[#E2E8F0]" />
                  : <div className="w-16 h-16 rounded-lg bg-[#F1F5F9] flex items-center justify-center border border-dashed border-[#CBD5E1]">
                      <Building2 size={20} className="text-[#94A3B8]" />
                    </div>}
                <label className="flex-1 cursor-pointer flex items-center gap-2 px-3 py-2 border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] text-sm text-[#64748B] transition-colors">
                  {uploadingFoto2 ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploadingFoto2 ? 'Enviando...' : fotoUrl2 ? 'Trocar foto' : 'Adicionar foto'}
                  <input type="file" accept="image/*,.heic,.heif" className="hidden" disabled={uploadingFoto2}
                    onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadFoto2(f) }} />
                </label>
                {fotoUrl2 && (
                  <button type="button" onClick={() => setFotoUrl2('')} aria-label="Remover foto 2" title="Remover foto 2" className="p-2 text-[#94A3B8] hover:text-red-500 transition-colors">
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Manual de instruções (PDF)</label>
            <div className="flex items-center gap-3">
              {manualUrl
                ? <a href={manualUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-[#4F7CFF] hover:underline truncate max-w-[160px]">
                    <FileText size={14} className="shrink-0" /> <span className="truncate">{manualNome || 'Ver manual'}</span>
                  </a>
                : <span className="text-sm text-[#94A3B8]">Nenhum arquivo</span>}
              <label className="flex-1 cursor-pointer flex items-center gap-2 px-3 py-2 border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] text-sm text-[#64748B] transition-colors">
                {uploadingManual ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploadingManual ? 'Enviando...' : manualUrl ? 'Trocar PDF' : 'Adicionar PDF'}
                <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={uploadingManual}
                  onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadManual(f) }} />
              </label>
              {manualUrl && (
                <button type="button" onClick={() => { setManualUrl(''); setManualNome('') }} aria-label="Remover manual" title="Remover manual" className="p-2 text-[#94A3B8] hover:text-red-500 transition-colors">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#4F7CFF] hover:bg-[#EEF2FF] rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={loading || enviando} className="btn-primary">{loading ? 'Salvando…' : enviando ? 'Enviando arquivo…' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
