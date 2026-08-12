export function sanitizarNomeArquivo(nome: string): string {
  const partes = nome.split('.')
  const ext = partes.length > 1 ? partes.pop() : ''
  const base = partes.join('.')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'arquivo'
  return ext ? `${base}.${ext.toLowerCase()}` : base
}
