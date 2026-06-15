'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Camera, Loader2 } from 'lucide-react'

interface Props {
  onScanned: (code: string) => void
  onClose: () => void
}

export default function BarcodeScannerModal({ onScanned, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const readerRef = useRef<any>(null)

  useEffect(() => {
    let active = true

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        if (!active) return

        const reader = new BrowserMultiFormatReader()
        readerRef.current = reader

        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        if (!devices.length) throw new Error('Nenhuma câmera encontrada.')

        // Prefere câmera traseira no mobile
        const back = devices.find(d =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('traseira') ||
          d.label.toLowerCase().includes('environment')
        )
        const deviceId = back?.deviceId ?? devices[devices.length - 1].deviceId

        setLoading(false)

        await reader.decodeFromVideoDevice(deviceId, videoRef.current!, (result, err) => {
          if (result && active) {
            onScanned(result.getText())
            onClose()
          }
        })
      } catch (e: any) {
        if (!active) return
        setLoading(false)
        if (e?.message?.includes('Permission') || e?.name === 'NotAllowedError') {
          setError('Permissão de câmera negada. Autorize o acesso nas configurações do navegador.')
        } else {
          setError(e?.message ?? 'Erro ao acessar a câmera.')
        }
      }
    }

    start()

    return () => {
      active = false
      if (readerRef.current) {
        try { readerRef.current.reset() } catch {}
      }
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-[#4F7CFF]" />
            <h2 className="font-syne font-semibold text-[#0F172A]">Escanear Código</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9]">
            <X size={16} className="text-[#64748B]" />
          </button>
        </div>

        <div className="relative bg-black aspect-[4/3] w-full">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
              <Loader2 size={28} className="animate-spin" />
              <span className="text-sm">Acessando câmera...</span>
            </div>
          )}
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <p className="text-white text-sm text-center">{error}</p>
            </div>
          ) : (
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          )}

          {/* Guia de mira */}
          {!loading && !error && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-32 border-2 border-[#4F7CFF] rounded-lg relative">
                <span className="absolute -top-px -left-px w-5 h-5 border-t-4 border-l-4 border-[#4F7CFF] rounded-tl" />
                <span className="absolute -top-px -right-px w-5 h-5 border-t-4 border-r-4 border-[#4F7CFF] rounded-tr" />
                <span className="absolute -bottom-px -left-px w-5 h-5 border-b-4 border-l-4 border-[#4F7CFF] rounded-bl" />
                <span className="absolute -bottom-px -right-px w-5 h-5 border-b-4 border-r-4 border-[#4F7CFF] rounded-br" />
                <div className="absolute top-1/2 -translate-y-px left-2 right-2 h-0.5 bg-[#4F7CFF]/60 animate-pulse" />
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 text-center">
          <p className="text-xs text-[#64748B]">Aponte a câmera para o código de barras ou QR code</p>
        </div>
      </div>
    </div>
  )
}
