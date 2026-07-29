import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function EtiquetaPage({ params }: { params: { equipId: string } }) {
  const sb = await createClient()
  const { data: equip } = await sb.from('equipamentos').select('*').eq('id', params.equipId).single()
  if (!equip) notFound()

  const { data: dados } = await sb
    .from('equipamento_dados')
    .select('*, campo:campos_tecnicos(nome)')
    .eq('equipamento_id', params.equipId)

  const e = equip as any
  const numeroSerie = (dados as any[])?.find((d: any) => d.campo?.nome?.toLowerCase().includes('série') || d.campo?.nome?.toLowerCase().includes('serie'))?.valor ?? e.numero_serie ?? null
  const modelo = (dados as any[])?.find((d: any) => d.campo?.nome?.toLowerCase().includes('modelo'))?.valor ?? e.modelo ?? null
  const pubUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://marv-gestao.vercel.app'}/pub/equipamento/${params.equipId}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=6&data=${encodeURIComponent(pubUrl)}`

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page {
          size: 80mm 50mm;
          margin: 0;
        }
        html, body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          background: white;
        }
        .label {
          width: 80mm;
          height: 50mm;
          display: flex;
          padding: 3mm;
          gap: 3mm;
        }
        .left {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }
        .logo {
          font-size: 15px;
          font-weight: 900;
          letter-spacing: 2px;
          color: #0F172A;
          line-height: 1;
        }
        .logo span {
          color: #4F7CFF;
        }
        .logo-sub {
          font-size: 5px;
          letter-spacing: 1.5px;
          color: #94A3B8;
          text-transform: uppercase;
          margin-top: 1mm;
        }
        .equip-nome {
          font-size: 10px;
          font-weight: 700;
          color: #0F172A;
          line-height: 1.2;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .tipo-badge {
          display: inline-block;
          font-size: 6px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          background: #EEF2FF;
          color: #4F7CFF;
          padding: 1px 4px;
          border-radius: 3px;
          margin-bottom: 1.5mm;
        }
        .fields {
          display: flex;
          flex-direction: column;
          gap: 1mm;
        }
        .field label {
          font-size: 5px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: #94A3B8;
          display: block;
        }
        .field span {
          font-size: 7px;
          font-weight: 600;
          color: #374151;
        }
        .divider {
          border: none;
          border-top: 0.5px solid #E2E8F0;
          margin: 1mm 0;
        }
        .right {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1mm;
          width: 28mm;
          flex-shrink: 0;
        }
        .right img {
          width: 26mm;
          height: 26mm;
          object-fit: contain;
        }
        .scan-text {
          font-size: 5px;
          color: #94A3B8;
          text-align: center;
          letter-spacing: 0.3px;
        }
        @media screen {
          body { background: #F1F5F9; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: 16px; }
          .label { background: white; box-shadow: 0 4px 24px #0002; border-radius: 4px; }
          .print-btn {
            background: #4F7CFF;
            color: white;
            border: none;
            padding: 10px 24px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 2px 8px #4F7CFF66;
          }
        }
        @media print {
          body { background: white; display: block; margin: 0; padding: 0; }
          .label { width: 80mm; height: 50mm; }
          .print-btn { display: none; }
        }
      `}</style>

      <div className="label">
        <div className="left">
          {/* Logo */}
          <div>
            <div className="logo">MARV<span>.</span></div>
            <div className="logo-sub">Mechanical Engineering</div>
          </div>

          {/* Equipamento */}
          <div>
            <div className="tipo-badge">{e.tipo}</div>
            <div className="equip-nome">{e.nome}</div>
          </div>

          {/* Campos */}
          <div className="fields">
            <hr className="divider" />
            {modelo && (
              <div className="field">
                <label>Modelo</label>
                <span>{modelo}</span>
              </div>
            )}
            {numeroSerie && (
              <div className="field">
                <label>Nº de Série</label>
                <span>{numeroSerie}</span>
              </div>
            )}
          </div>
        </div>

        <div className="right">
          <img src={qrUrl} alt="QR Code" />
          <div className="scan-text">Escaneie para<br />ver a ficha técnica</div>
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
