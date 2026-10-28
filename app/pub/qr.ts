// URL da ficha pública (QR) e imagem do QR — usados na tela do sistema e na etiqueta impressa,
// para os dois apontarem para a mesma origem: NEXT_PUBLIC_SITE_URL quando configurado,
// senão a origem de quem está usando (window.location.origin no client, host da requisição no servidor).
export function urlPublica(caminho: string, origemFallback: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || origemFallback).replace(/\/+$/, '')
  return `${base}${caminho}`
}

// Imagem do QR gerada pelo api.qrserver.com (não há lib de QR instalada no projeto)
export function qrImagemUrl(conteudo: string, tamanho = 300, margem = 6): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${tamanho}x${tamanho}&margin=${margem}&data=${encodeURIComponent(conteudo)}`
}
