'use client'

// Estados das telas de impressão: "carregando" e "não encontrado" separados,
// para a tela não ficar presa em "Preparando…" quando o registro não existe.
// Atenção: não usar a classe `.no-print` aqui — o gerador de PDF do RDO espera
// por ela como sinal de que os dados carregaram.

export function PrintCarregando({ texto }: { texto: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'white' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #4F7CFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: '#64748B', fontSize: 13 }}>{texto}</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export function PrintNaoEncontrado({ texto, voltarHref, voltarTexto }: { texto: string; voltarHref: string; voltarTexto: string }) {
  function voltar(e: React.MouseEvent) {
    // Aberta em nova aba (sem histórico): segue o link; senão volta para a tela anterior
    if (window.history.length > 1) { e.preventDefault(); window.history.back() }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'white', padding: 16 }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <p style={{ color: '#0F172A', fontSize: 15, fontWeight: 600, margin: '0 0 6px' }}>{texto}</p>
        <p style={{ color: '#64748B', fontSize: 13, margin: '0 0 16px' }}>Ele pode ter sido excluído, ou o link está incompleto.</p>
        <a href={voltarHref} onClick={voltar}
          style={{ display: 'inline-block', background: '#4F7CFF', color: 'white', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          {voltarTexto}
        </a>
      </div>
    </div>
  )
}
