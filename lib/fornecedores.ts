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
