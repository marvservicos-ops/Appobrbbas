import type { SupabaseClient } from '@supabase/supabase-js'

export interface Fornecedor {
  id: string
  nome: string
  nome_fantasia: string | null
  cnpj: string | null
  telefone: string | null
  email: string | null
  observacao: string | null
  ativo: boolean
}

export const somenteDigitos = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '')

// Máscara de CNPJ (14 dígitos) ou CPF (11), aplicada enquanto digita
export function formatarDocumento(v: string | null | undefined): string {
  const d = somenteDigitos(v).slice(0, 14)
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2')
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export const nomeFornecedor = (f: Pick<Fornecedor, 'nome' | 'nome_fantasia'> | null | undefined) =>
  f ? (f.nome_fantasia || f.nome) : '—'

// Busca por razão social, nome fantasia ou CNPJ (com ou sem pontuação)
export function fornecedorCombina(f: Fornecedor, busca: string): boolean {
  const q = busca.trim().toLowerCase()
  if (!q) return true
  const dq = somenteDigitos(q)
  return f.nome.toLowerCase().includes(q)
    || (f.nome_fantasia ?? '').toLowerCase().includes(q)
    || (dq.length >= 3 && (f.cnpj ?? '').includes(dq))
}

// Acha o fornecedor pelo CNPJ (ou pelo nome, se não houver CNPJ); com CNPJ e
// sem cadastro, cadastra com os dados lidos (NF ou DDA). `criado` avisa quem
// mantém a lista em memória.
export async function garantirFornecedor(
  sb: SupabaseClient,
  dados: { nome?: string | null; fantasia?: string | null; cnpj?: string | null },
  lista: Fornecedor[],
): Promise<{ fornecedor: Fornecedor | null; criado: boolean }> {
  const cnpj = somenteDigitos(dados.cnpj)
  const nome = (dados.nome || dados.fantasia || '').trim()
  if (cnpj) {
    const existente = lista.find(f => f.cnpj === cnpj)
    if (existente) return { fornecedor: existente, criado: false }
    if (!nome) return { fornecedor: null, criado: false }
    const { data, error } = await sb.from('fornecedores')
      .insert({ nome, nome_fantasia: dados.fantasia?.trim() || null, cnpj })
      .select().single()
    if (!error && data) return { fornecedor: data as Fornecedor, criado: true }
    // Cadastrado por outra pessoa desde que a lista foi carregada
    const { data: achado } = await sb.from('fornecedores').select('*').eq('cnpj', cnpj).maybeSingle()
    return { fornecedor: (achado as Fornecedor | null) ?? null, criado: Boolean(achado) }
  }
  const q = nome.toLowerCase()
  if (!q) return { fornecedor: null, criado: false }
  const achado = lista.find(f => f.ativo && (f.nome.toLowerCase() === q || f.nome_fantasia?.toLowerCase() === q))
  return { fornecedor: achado ?? null, criado: false }
}
