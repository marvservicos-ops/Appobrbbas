import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EtiquetaPrintButton from '@/components/EtiquetaPrintButton'

export default async function EtiquetaPage({ params }: { params: { equipId: string } }) {
  const sb = await createClient()
  const { data: equip } = await sb.from('equipamentos').select('*').eq('id', params.equipId).single()
  if (!equip) notFound()

  const e = equip as any
  const pubUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://marv-gestao.vercel.app'}/pub/equipamento/${params.equipId}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=6&data=${encodeURIComponent(pubUrl)}`

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: 50mm 80mm; margin: 0; }
        html, body { font-family: 'Helvetica Neue', Arial, sans-serif; background: white; }
        .label {
          width: 50mm;
          height: 80mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4mm;
          gap: 3mm;
          overflow: hidden;
          border: 0.3mm dashed #94A3B8;
        }
        .logo { font-size: 12px; font-weight: 900; letter-spacing: 1.5px; color: #0F172A; line-height: 1; text-align: center; }
        .logo span { color: #4F7CFF; }
        .logo-sub { font-size: 5px; letter-spacing: 1.2px; color: #94A3B8; text-transform: uppercase; margin-top: 0.8mm; text-align: center; }
        .ativo-nome {
          font-size: 10px;
          font-weight: 700;
          color: #0F172A;
          line-height: 1.25;
          text-align: center;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
        }
        .qr img { width: 34mm; height: 34mm; object-fit: contain; display: block; }
        .scan-text { font-size: 5px; color: #94A3B8; text-align: center; line-height: 1.4; }
        @media screen {
          body { background: #F1F5F9; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: 24px; }
          .label { background: white; box-shadow: 0 4px 24px #0002; border-radius: 4px; transform: scale(2.2); transform-origin: center center; margin: 90px 0; }
          .print-btn { background: #4F7CFF; color: white; border: none; padding: 10px 24px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px #4F7CFF66; }
        }
        @media print {
          body { background: white; display: block; margin: 0; padding: 0; }
          .label { width: 50mm; height: 80mm; }
          .print-btn { display: none; }
        }
      `}</style>

      <div className="label">
        <div>
          <div className="logo">MARV<span>.</span></div>
          <div className="logo-sub">Mechanical Engineering</div>
        </div>
        <div className="ativo-nome">{e.nome}</div>
        <div className="qr">
          <img src={qrUrl} alt="QR Code" />
        </div>
        <div className="scan-text">Escaneie para<br />ver a ficha técnica</div>
      </div>

      <EtiquetaPrintButton />
    </>
  )
}
