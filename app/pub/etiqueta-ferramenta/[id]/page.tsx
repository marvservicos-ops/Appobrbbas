import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function EtiquetaFerramentaPage({ params }: { params: { id: string } }) {
  const sb = await createClient()
  const { data: ferramenta } = await sb.from('ferramentas').select('*').eq('id', params.id).single()
  if (!ferramenta) notFound()

  const f = ferramenta as any
  const pubUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://marv-gestao.vercel.app'}/pub/ferramenta/${params.id}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=6&data=${encodeURIComponent(pubUrl)}`

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: 80mm 50mm; margin: 0; }
        html, body { font-family: 'Helvetica Neue', Arial, sans-serif; background: white; }
        .label {
          width: 80mm;
          height: 50mm;
          display: flex;
          padding: 2.5mm;
          gap: 2mm;
          overflow: hidden;
        }
        .left {
          display: flex;
          flex-direction: column;
          gap: 1.5mm;
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }
        .logo { font-size: 11px; font-weight: 900; letter-spacing: 1.5px; color: #0F172A; line-height: 1; }
        .logo span { color: #4F7CFF; }
        .logo-sub { font-size: 4.5px; letter-spacing: 1.2px; color: #94A3B8; text-transform: uppercase; margin-top: 0.5mm; }
        .tipo-badge {
          display: inline-block;
          font-size: 5.5px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          background: #EEF2FF;
          color: #4F7CFF;
          padding: 1px 3px;
          border-radius: 2px;
        }
        .equip-nome {
          font-size: 9px;
          font-weight: 700;
          color: #0F172A;
          line-height: 1.15;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .divider { border: none; border-top: 0.4px solid #E2E8F0; }
        .fields { display: flex; flex-direction: column; gap: 1mm; }
        .field-label { font-size: 4.5px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase; color: #94A3B8; }
        .field-value { font-size: 6.5px; font-weight: 600; color: #374151; line-height: 1.2; }
        .right {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1mm;
          width: 26mm;
          flex-shrink: 0;
        }
        .right img { width: 24mm; height: 24mm; object-fit: contain; display: block; }
        .scan-text { font-size: 4.5px; color: #94A3B8; text-align: center; line-height: 1.4; }
        @media screen {
          body { background: #F1F5F9; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: 24px; }
          .label { background: white; box-shadow: 0 4px 24px #0002; border-radius: 4px; transform: scale(2); transform-origin: center center; margin: 60px 0; }
          .print-btn { background: #4F7CFF; color: white; border: none; padding: 10px 24px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px #4F7CFF66; }
        }
        @media print {
          body { background: white; display: block; margin: 0; padding: 0; }
          .label { width: 80mm; height: 50mm; }
          .print-btn { display: none; }
        }
      `}</style>

      <div className="label">
        <div className="left">
          <div>
            <div className="logo">MARV<span>.</span></div>
            <div className="logo-sub">Mechanical Engineering</div>
          </div>
          {f.codigo_interno && <div className="tipo-badge">{f.codigo_interno}</div>}
          <div className="equip-nome">{f.nome}</div>
          <div className="divider" />
          <div className="fields">
            {f.categoria && (
              <div>
                <div className="field-label">Categoria</div>
                <div className="field-value">{f.categoria}</div>
              </div>
            )}
            {f.modelo && (
              <div>
                <div className="field-label">Modelo</div>
                <div className="field-value">{f.modelo}</div>
              </div>
            )}
            {f.numero_serie && (
              <div>
                <div className="field-label">Nº de Série</div>
                <div className="field-value">{f.numero_serie}</div>
              </div>
            )}
          </div>
        </div>

        <div className="right">
          <img src={qrUrl} alt="QR Code" />
          <div className="scan-text">Escaneie para<br />ver a ficha</div>
        </div>
      </div>

      <button className="print-btn" id="print-btn">
        Imprimir / Salvar PDF
      </button>

      <script dangerouslySetInnerHTML={{ __html: `
        document.getElementById('print-btn').addEventListener('click', function() { window.print(); });
        window.addEventListener('load', function() {
          if (new URLSearchParams(location.search).get('print') === '1') {
            setTimeout(() => window.print(), 800);
          }
        });
      `}} />
    </>
  )
}
