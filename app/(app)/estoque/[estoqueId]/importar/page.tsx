'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, Upload, Check, AlertCircle, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Estoque, EstoqueCampo, EstoqueProduto } from '@/lib/types'
import Link from 'next/link'
import { ajustarSaldo, controlaSaldo } from '@/lib/estoque/saldo'
import { hojeLocal } from '@/lib/datas'
import { parseNumeroBR } from '@/lib/numero'
import { mensagemErro } from '@/lib/erros'

type CsvRow = Record<string, string>

const CAMPOS_FIXOS = [
  { key: 'data', label: 'Data' },
  { key: 'produto_nome', label: 'Produto' },
  { key: 'quantidade', label: 'Quantidade' },
  { key: 'unidade', label: 'Unidade de medida' },
  { key: 'responsavel', label: 'Responsável' },
  { key: 'tipo', label: 'Tipo (entrada/saida)' },
  { key: 'observacoes', label: 'Observações' },
  { key: '__ignorar__', label: '— Ignorar coluna —' },
]

// Separador mais frequente na 1ª linha (fora de aspas); empate segue a ordem ; tab | ,
function detectarSeparador(texto: string): string {
  const primeira: string[] = []
  let aspas = false
  for (const ch of texto) {
    if (ch === '"') aspas = !aspas
    else if (!aspas && (ch === '\n' || ch === '\r')) break
    else if (!aspas) primeira.push(ch)
  }
  let melhor = ','
  let max = 0
  for (const sep of [';', '\t', '|', ',']) {
    const n = primeira.filter(c => c === sep).length
    if (n > max) { max = n; melhor = sep }
  }
  return melhor
}

// CSV com aspas: "a;b" fica numa coluna, "" é aspa literal e quebra de linha dentro de aspas é mantida
function parseCSV(textoOriginal: string): { headers: string[]; rows: CsvRow[] } {
  const texto = textoOriginal.replace(/^\uFEFF/, '')
  const sep = detectarSeparador(texto)
  const linhas: string[][] = []
  let linha: string[] = []
  let campo = ''
  let aspas = false
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i]
    if (aspas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++ } else aspas = false
      } else campo += ch
    } else if (ch === '"') aspas = true
    else if (ch === sep) { linha.push(campo); campo = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++
      linha.push(campo); linhas.push(linha); linha = []; campo = ''
    } else campo += ch
  }
  if (campo !== '' || linha.length > 0) { linha.push(campo); linhas.push(linha) }

  const [cab = [], ...resto] = linhas
  const headers = cab.map(h => h.trim())
  const rows = resto.map(vals => {
    const row: CsvRow = {}
    headers.forEach((h, i) => { row[h] = (vals[i] ?? '').trim() })
    return row
  }).filter(r => Object.values(r).some(v => v))
  return { headers, rows }
}

const normalizar = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// Nomes de coluna reconhecidos automaticamente (comparados sem acento/maiúscula)
const SINONIMOS: Record<string, string[]> = {
  data: ['data', 'dia', 'data movimento', 'data movimentacao'],
  produto_nome: ['produto', 'nome', 'nome do produto', 'descricao', 'item', 'material'],
  quantidade: ['quantidade', 'qtd', 'qtde', 'quant', 'qtd atual', 'quantidade atual', 'saldo', 'estoque'],
  qtd_min: ['qtd minima', 'qtd min', 'quantidade minima', 'estoque minimo', 'minimo', 'min'],
  unidade: ['unidade', 'un', 'und', 'unid', 'unidade de medida', 'medida'],
  codigo: ['codigo', 'cod', 'cod produto', 'codigo do produto', 'n ca', 'no ca', 'ca', 'referencia', 'ref'],
  responsavel: ['responsavel', 'quem', 'funcionario', 'usuario'],
  tipo: ['tipo', 'movimento', 'movimentacao', 'entrada saida', 'operacao'],
  observacoes: ['observacoes', 'observacao', 'obs'],
}

function autoMapear(headers: string[], destinos: { key: string; label: string }[]): Record<string, string> {
  const mapa: Record<string, string> = {}
  const usados = new Set<string>()
  for (const h of headers) {
    const hn = normalizar(h)
    const match = destinos.find(d => d.key !== '__ignorar__' && !usados.has(d.key) && (
      (SINONIMOS[d.key] ?? []).includes(hn) || normalizar(d.label) === hn
    ))
    mapa[h] = match?.key ?? '__ignorar__'
    if (match) usados.add(match.key)
  }
  return mapa
}

function parseDate(str: string): string | null {
  if (!str) return null
  const br = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  return null
}

export default function ImportarPage() {
  const { estoqueId } = useParams<{ estoqueId: string }>()
  const fileRef = useRef<HTMLInputElement>(null)

  const [estoque, setEstoque] = useState<Estoque | null>(null)
  const [campos, setCampos] = useState<EstoqueCampo[]>([])
  const [produtos, setProdutos] = useState<EstoqueProduto[]>([])
  const [loading, setLoading] = useState(true)

  const [tipoImport, setTipoImport] = useState<'registros' | 'produtos'>('registros')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [mapeamento, setMapeamento] = useState<Record<string, string>>({})
  const [cadastrarProdutos, setCadastrarProdutos] = useState(true)
  const [atualizarSaldo, setAtualizarSaldo] = useState(true)
  // Tipo usado quando não há coluna "Tipo" mapeada (ou a linha não diz entrada/saída)
  const [tipoPadrao, setTipoPadrao] = useState<'' | 'entrada' | 'saida'>('')
  const [importing, setImporting] = useState(false)
  const [resultado, setResultado] = useState<{ tipo: 'registros' | 'produtos'; ok: number; produtosCriados: number; erros: string[]; avisos: string[] } | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: est }, { data: cam }, { data: prod }] = await Promise.all([
        supabase.from('estoques').select('*').eq('id', estoqueId).single(),
        supabase.from('estoque_campos').select('*').eq('estoque_id', estoqueId).order('ordem'),
        supabase.from('estoque_produtos').select('*').eq('estoque_id', estoqueId).eq('ativo', true),
      ])
      setEstoque(est)
      setCampos(cam ?? [])
      setProdutos(prod ?? [])
      setLoading(false)
    }
    load()
  }, [estoqueId])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const { headers, rows } = parseCSV(text)
      setCsvHeaders(headers)
      setCsvRows(rows)
      // Usa os campos do tipo de importação escolhido (produtos ou registros)
      setMapeamento(autoMapear(headers, todasDestinos))
      setResultado(null)
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function importarProdutos() {
    setImporting(true)
    const supabase = createClient()
    const erros: string[] = []
    let ok = 0

    const produtosExistentes = new Set(produtos.map(p => p.nome.toLowerCase().trim()))

    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i]
      try {
        const get = (key: string) => {
          const col = Object.entries(mapeamento).find(([, v]) => v === key)?.[0]
          return col ? (row[col] ?? '').trim() : ''
        }
        const nome = get('produto_nome')
        if (!nome) { erros.push(`Linha ${i + 2}: nome vazio`); continue }
        if (produtosExistentes.has(nome.toLowerCase())) { erros.push(`Linha ${i + 2}: "${nome}" já existe`); continue }
        const qtdAtual = get('quantidade') ? parseNumeroBR(get('quantidade')) : 0
        const qtdMin = get('qtd_min') ? parseNumeroBR(get('qtd_min')) : 0
        if (Number.isNaN(qtdAtual)) { erros.push(`Linha ${i + 2}: quantidade inválida ("${get('quantidade')}")`); continue }
        if (Number.isNaN(qtdMin)) { erros.push(`Linha ${i + 2}: qtd mínima inválida ("${get('qtd_min')}")`); continue }

        const { error: err } = await supabase.from('estoque_produtos').insert({
          estoque_id: estoqueId,
          nome,
          codigo: get('codigo') || null,
          unidade: get('unidade') || 'un',
          quantidade_atual: qtdAtual,
          quantidade_minima: qtdMin,
        })
        if (err) { erros.push(`Linha ${i + 2}: ${mensagemErro(err)}`); continue }
        produtosExistentes.add(nome.toLowerCase())
        ok++
      } catch {
        erros.push(`Linha ${i + 2}: erro inesperado`)
      }
    }

    setResultado({ tipo: 'produtos', ok, produtosCriados: 0, erros, avisos: [] })
    setImporting(false)
  }

  async function importar() {
    if (tipoImport === 'produtos') { await importarProdutos(); return }
    const temColunaTipo = Object.values(mapeamento).includes('tipo')
    if (!temColunaTipo && !tipoPadrao) { alert('Nenhuma coluna está mapeada como "Tipo". Escolha se os registros são entradas ou saídas.'); return }
    setImporting(true)
    const supabase = createClient()
    const erros: string[] = []
    const avisos: string[] = []
    let ok = 0
    let produtosCriados = 0

    // Mapa de produtos existentes
    const produtoMap: Record<string, string> = {}
    for (const p of produtos) produtoMap[p.nome.toLowerCase().trim()] = p.id
    const prodPorId = new Map(produtos.map(p => [p.id, p]))

    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i]
      try {
        const get = (key: string) => {
          const col = Object.entries(mapeamento).find(([, v]) => v === key)?.[0]
          return col ? (row[col] ?? '').trim() : ''
        }

        const produto_nome = get('produto_nome')
        if (!produto_nome) { erros.push(`Linha ${i + 2}: produto vazio`); continue }

        const qtdStr = get('quantidade')
        const quantidade = qtdStr ? parseNumeroBR(qtdStr) : 0
        // Aceita 0 e vazios (considera 0)
        if (isNaN(quantidade)) { erros.push(`Linha ${i + 2}: quantidade inválida ("${qtdStr}")`); continue }

        const responsavel = get('responsavel') || 'Importado'
        const dataStr = parseDate(get('data')) ?? hojeLocal()
        const tipoTxt = normalizar(get('tipo'))
        const tipo = tipoTxt.startsWith('e') ? 'entrada' : tipoTxt.startsWith('s') ? 'saida' : tipoPadrao
        if (!tipo) { erros.push(`Linha ${i + 2}: tipo não reconhecido ("${get('tipo')}") — use entrada ou saída`); continue }
        const unidade = get('unidade') || 'un'
        const observacoes = get('observacoes') || null

        // Criar produto se não existir e opção ligada
        let produto_id = produtoMap[produto_nome.toLowerCase().trim()] ?? null
        if (!produto_id && cadastrarProdutos) {
          const { data: novoProd, error: errProd } = await supabase.from('estoque_produtos').insert({
            estoque_id: estoqueId, nome: produto_nome, unidade,
          }).select().single()
          if (errProd || !novoProd) {
            avisos.push(`Linha ${i + 2}: produto "${produto_nome}" não foi cadastrado (${mensagemErro(errProd)}); registro importado sem vínculo e sem mexer em saldo`)
          } else {
            produto_id = novoProd.id
            produtoMap[produto_nome.toLowerCase().trim()] = novoProd.id
            prodPorId.set(novoProd.id, novoProd as EstoqueProduto)
            produtosCriados++
          }
        }

        const { data: reg, error: regErr } = await supabase.from('estoque_registros').insert({
          estoque_id: estoqueId, produto_id, produto_nome, tipo, quantidade, unidade,
          responsavel, data: dataStr, observacoes,
        }).select().single()

        if (regErr) { erros.push(`Linha ${i + 2}: ${mensagemErro(regErr)}`); continue }

        const valores = campos.map(c => {
          const col = Object.entries(mapeamento).find(([, v]) => v === `campo_${c.id}`)?.[0]
          const valor = col ? (row[col] ?? '').trim() : ''
          return valor ? { registro_id: reg.id, campo_id: c.id, valor } : null
        }).filter((v): v is { registro_id: string; campo_id: string; valor: string } => v !== null)

        if (valores.length > 0) {
          const { error: errVal } = await supabase.from('estoque_registro_valores').insert(valores)
          if (errVal) avisos.push(`Linha ${i + 2}: campos extras não gravados (${mensagemErro(errVal)})`)
        }

        if (atualizarSaldo && produto_id && quantidade !== 0) {
          const prod = prodPorId.get(produto_id)
          const { error: errSaldo } = await ajustarSaldo(supabase, produto_id, tipo === 'entrada' ? quantidade : -quantidade, { pisoZero: !controlaSaldo(prod) })
          if (errSaldo) avisos.push(`Linha ${i + 2}: saldo de "${produto_nome}" não atualizado (${mensagemErro(errSaldo)})`)
        }

        ok++
      } catch {
        erros.push(`Linha ${i + 2}: erro inesperado`)
      }
    }

    setResultado({ tipo: 'registros', ok, produtosCriados, erros, avisos })
    setImporting(false)
  }

  const CAMPOS_PRODUTO = [
    { key: 'produto_nome', label: 'Nome do produto' },
    { key: 'codigo', label: 'Código / Nº CA' },
    { key: 'unidade', label: 'Unidade de medida' },
    { key: 'quantidade', label: 'Qtd Atual' },
    { key: 'qtd_min', label: 'Qtd Mínima' },
    { key: '__ignorar__', label: '— Ignorar coluna —' },
  ]

  const todasDestinos = tipoImport === 'produtos'
    ? CAMPOS_PRODUTO
    : [...CAMPOS_FIXOS, ...campos.map(c => ({ key: `campo_${c.id}`, label: c.nome }))]

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 size={28} className="animate-spin text-[#4F7CFF]" />
    </div>
  )

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/estoque/${estoqueId}`} className="w-9 h-9 rounded-xl border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F1F5F9] transition-colors">
          <ArrowLeft size={16} className="text-[#64748B]" />
        </Link>
        <div>
          <h1 className="font-syne font-bold text-xl text-[#0F172A]">Importar CSV</h1>
          <p className="text-xs text-[#64748B]">{estoque?.nome}</p>
        </div>
      </div>

      <div className="card bg-[#F0F9FF] border-[#BAE6FD] mb-6">
        <p className="text-sm text-[#0369A1] font-medium mb-1">Como importar</p>
        <ul className="text-xs text-[#0369A1] space-y-0.5 list-disc list-inside">
          <li>Exporte a planilha do seu sistema atual como CSV</li>
          <li>O sistema detecta automaticamente as colunas — você pode ajustar o mapeamento</li>
          <li>Datas aceitas: DD/MM/AAAA ou AAAA-MM-DD</li>
          <li>Números no formato brasileiro (1.234,56) ou com ponto (1234.56)</li>
          <li>Linhas com quantidade 0 são aceitas normalmente</li>
        </ul>
      </div>

      {/* Seletor de tipo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-6">
        {([
          { key: 'registros', label: '📋 Importar Registros', desc: 'Entradas e saídas do estoque' },
          { key: 'produtos', label: '📦 Importar Produtos', desc: 'Cadastro de itens do estoque' },
        ] as const).map(op => (
          <button key={op.key} type="button"
            onClick={() => { setTipoImport(op.key); setCsvRows([]); setCsvHeaders([]); setResultado(null); if (fileRef.current) fileRef.current.value = '' }}
            className={`flex-1 px-4 py-3 rounded-xl border-2 text-left transition-all ${tipoImport === op.key ? 'border-[#4F7CFF] bg-[#EEF2FF]' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'}`}>
            <p className={`text-sm font-semibold ${tipoImport === op.key ? 'text-[#4F7CFF]' : 'text-[#374151]'}`}>{op.label}</p>
            <p className="text-xs text-[#94A3B8] mt-0.5">{op.desc}</p>
          </button>
        ))}
      </div>

      {csvRows.length === 0 && (
        <label className="flex flex-col items-center justify-center gap-3 w-full h-44 border-2 border-dashed border-[#E2E8F0] rounded-2xl cursor-pointer hover:border-[#4F7CFF] hover:bg-[#F8FAFF] transition-colors">
          <Upload size={28} className="text-[#94A3B8]" />
          <div className="text-center">
            <p className="text-sm font-medium text-[#374151]">Clique para selecionar o arquivo CSV</p>
            <p className="text-xs text-[#94A3B8] mt-0.5">Separadores aceitos: vírgula, ponto e vírgula ou tab</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
        </label>
      )}

      {csvRows.length > 0 && !resultado && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[#374151]">{csvRows.length} linhas encontradas — mapeie as colunas:</p>
            <button onClick={() => { setCsvRows([]); setCsvHeaders([]); if (fileRef.current) fileRef.current.value = '' }}
              className="text-xs text-[#94A3B8] hover:text-[#64748B] flex items-center gap-1"><X size={12} /> Trocar arquivo</button>
          </div>

          {/* Opção: cadastrar produtos */}
          <label className="flex items-center gap-3 px-4 py-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] cursor-pointer">
            <input type="checkbox" checked={cadastrarProdutos} onChange={e => setCadastrarProdutos(e.target.checked)} className="w-4 h-4 accent-[#4F7CFF]" />
            <div>
              <p className="text-sm font-medium text-[#374151]">Cadastrar produtos automaticamente</p>
              <p className="text-xs text-[#94A3B8]">Cria os produtos na aba Produtos para cada nome único encontrado no CSV</p>
            </div>
          </label>

          {tipoImport === 'registros' && (
            <label className="flex items-center gap-3 px-4 py-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] cursor-pointer">
              <input type="checkbox" checked={atualizarSaldo} onChange={e => setAtualizarSaldo(e.target.checked)} className="w-4 h-4 accent-[#4F7CFF]" />
              <div>
                <p className="text-sm font-medium text-[#374151]">Atualizar o saldo dos produtos</p>
                <p className="text-xs text-[#94A3B8]">
                  {atualizarSaldo
                    ? 'Cada entrada soma e cada saída desconta do saldo do produto.'
                    : 'O saldo dos produtos NÃO muda (use para histórico antigo, quando o saldo atual já está certo).'}
                </p>
              </div>
            </label>
          )}

          {tipoImport === 'registros' && (
            <div className="px-4 py-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-1.5">
              <label className="block text-sm font-medium text-[#374151]">
                {Object.values(mapeamento).includes('tipo') ? 'Tipo quando a linha não disser entrada/saída' : 'Tipo dos registros *'}
              </label>
              <select className="field text-sm" value={tipoPadrao} onChange={e => setTipoPadrao(e.target.value as typeof tipoPadrao)}>
                <option value="">{Object.values(mapeamento).includes('tipo') ? 'Nenhum (linha vira erro)' : 'Selecione...'}</option>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
              {!Object.values(mapeamento).includes('tipo') && (
                <p className="text-xs text-amber-700">Nenhuma coluna está mapeada como &quot;Tipo&quot;: escolha se o arquivo é de entradas ou de saídas.</p>
              )}
            </div>
          )}

          <div className="card p-0 overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Coluna no CSV</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Exemplo</th>
                  <th className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Mapear para</th>
                </tr>
              </thead>
              <tbody>
                {csvHeaders.map(h => (
                  <tr key={h} className="border-b border-[#F1F5F9]">
                    <td className="px-4 py-2.5 text-sm font-medium text-[#0F172A]">{h}</td>
                    <td className="px-4 py-2.5 text-xs text-[#64748B] max-w-[200px] truncate">{csvRows[0]?.[h] ?? ''}</td>
                    <td className="px-4 py-2.5">
                      <select className="field text-sm py-1.5" value={mapeamento[h] ?? '__ignorar__'}
                        onChange={e => setMapeamento(m => ({ ...m, [h]: e.target.value }))}>
                        {todasDestinos.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Preview */}
          <div>
            <p className="text-xs font-semibold text-[#64748B] mb-2 uppercase tracking-wide">Preview (primeiras 3 linhas)</p>
            <div className="overflow-x-auto card p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    {csvHeaders.map(h => (
                      <th key={h} className="text-left font-semibold text-[#64748B] px-3 py-2 whitespace-nowrap">
                        {h}
                        <span className="block font-normal text-[#94A3B8]">→ {todasDestinos.find(d => d.key === mapeamento[h])?.label ?? '—'}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvRows.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-b border-[#F1F5F9]">
                      {csvHeaders.map(h => <td key={h} className="px-3 py-2 text-[#374151] max-w-[160px] truncate">{row[h]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <Link href={`/estoque/${estoqueId}`} className="px-5 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9] transition-colors">
              Cancelar
            </Link>
            <button onClick={importar} disabled={importing || (tipoImport === 'registros' && !Object.values(mapeamento).includes('tipo') && !tipoPadrao)} className="btn-primary flex items-center gap-2 px-6 w-full sm:w-auto">
              {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {importing ? 'Importando...' : `Importar ${csvRows.length} ${tipoImport === 'produtos' ? 'produtos' : 'registros'}`}
            </button>
          </div>
        </div>
      )}

      {resultado && (
        <div className="space-y-4">
          <div className={`card border-2 ${resultado.erros.length === 0 ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
            <div className="flex items-center gap-3 mb-2">
              {resultado.erros.length === 0 ? <Check size={20} className="text-green-600" /> : <AlertCircle size={20} className="text-yellow-600" />}
              <div>
                <p className="font-semibold text-[#0F172A]">
                  {resultado.ok} {resultado.tipo === 'produtos' ? 'produto' : 'registro'}{resultado.ok !== 1 ? 's' : ''} importado{resultado.ok !== 1 ? 's' : ''}
                  {resultado.erros.length > 0 ? `, ${resultado.erros.length} com erro` : ' com sucesso'}
                </p>
                {resultado.produtosCriados > 0 && (
                  <p className="text-sm text-green-700 mt-0.5">+ {resultado.produtosCriados} produto{resultado.produtosCriados !== 1 ? 's' : ''} criado{resultado.produtosCriados !== 1 ? 's' : ''} automaticamente</p>
                )}
              </div>
            </div>
            {resultado.erros.length > 0 && (
              <ul className="text-xs text-yellow-700 space-y-0.5 list-disc list-inside mt-2">
                {resultado.erros.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                {resultado.erros.length > 10 && <li>...e mais {resultado.erros.length - 10} erros</li>}
              </ul>
            )}
            {resultado.avisos.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-amber-800">Avisos ({resultado.avisos.length}):</p>
                <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside mt-1">
                  {resultado.avisos.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                  {resultado.avisos.length > 10 && <li>...e mais {resultado.avisos.length - 10} avisos</li>}
                </ul>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setResultado(null); setCsvRows([]); setCsvHeaders([]); if (fileRef.current) fileRef.current.value = '' }}
              className="px-5 py-2.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9] transition-colors">
              Importar outro arquivo
            </button>
            <Link href={`/estoque/${estoqueId}`} className="btn-primary flex items-center gap-2 px-6">
              {resultado.tipo === 'produtos' ? 'Ver produtos' : 'Ver registros importados'}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
