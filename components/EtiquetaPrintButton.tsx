'use client'

import { useEffect } from 'react'

// Espera as imagens da etiqueta (logo e QR, que vem do api.qrserver.com) antes de
// abrir a impressão automática, para não sair a etiqueta sem o QR.
function imagensCarregadas(): Promise<void> {
  const pendentes = Array.from(document.images).filter(img => !img.complete)
  return Promise.all(pendentes.map(img => new Promise<void>(ok => {
    img.addEventListener('load', () => ok(), { once: true })
    img.addEventListener('error', () => ok(), { once: true })
  }))).then(() => undefined)
}

export default function EtiquetaPrintButton() {
  useEffect(() => {
    if (new URLSearchParams(location.search).get('print') !== '1') return
    let cancelado = false
    let t: ReturnType<typeof setTimeout> | undefined
    // No máximo 5s esperando o QR; depois imprime mesmo assim
    Promise.race([imagensCarregadas(), new Promise<void>(ok => setTimeout(ok, 5000))]).then(() => {
      if (!cancelado) t = setTimeout(() => window.print(), 300)
    })
    return () => { cancelado = true; if (t) clearTimeout(t) }
  }, [])

  return (
    <button className="print-btn" onClick={() => window.print()}>
      Imprimir / Salvar PDF
    </button>
  )
}
