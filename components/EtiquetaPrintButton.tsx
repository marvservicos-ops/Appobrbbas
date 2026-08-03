'use client'

import { useEffect } from 'react'

export default function EtiquetaPrintButton() {
  useEffect(() => {
    if (new URLSearchParams(location.search).get('print') === '1') {
      const t = setTimeout(() => window.print(), 800)
      return () => clearTimeout(t)
    }
  }, [])

  return (
    <button className="print-btn" onClick={() => window.print()}>
      Imprimir / Salvar PDF
    </button>
  )
}
