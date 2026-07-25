'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { StickyNote, X } from 'lucide-react'
import NotasPanel from './NotasPanel'

const STORAGE_KEY = 'marv_notas_btn_pos'
const BTN_SIZE = 44

export default function NotasFlutuante() {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragging = useRef(false)
  const didDrag = useRef(false)
  const offset = useRef({ x: 0, y: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
      if (saved?.x != null) { setPos(clamp(saved.x, saved.y)); return }
    } catch {}
    setPos({ x: window.innerWidth - BTN_SIZE - 20, y: window.innerHeight - BTN_SIZE - 100 })
  }, [])

  function clamp(x: number, y: number) {
    return {
      x: Math.max(0, Math.min(x, window.innerWidth - BTN_SIZE)),
      y: Math.max(0, Math.min(y, window.innerHeight - BTN_SIZE)),
    }
  }

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    dragging.current = true
    didDrag.current = false
    const rect = btnRef.current!.getBoundingClientRect()
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    e.preventDefault()
  }, [])

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return
      didDrag.current = true
      setPos(clamp(e.clientX - offset.current.x, e.clientY - offset.current.y))
    }
    function onMouseUp() {
      if (!dragging.current) return
      dragging.current = false
      setPos(p => { if (p) localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); return p })
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp) }
  }, [])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    dragging.current = true
    didDrag.current = false
    const touch = e.touches[0]
    const rect = btnRef.current!.getBoundingClientRect()
    offset.current = { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
  }, [])

  useEffect(() => {
    function onTouchMove(e: TouchEvent) {
      if (!dragging.current) return
      didDrag.current = true
      const touch = e.touches[0]
      setPos(clamp(touch.clientX - offset.current.x, touch.clientY - offset.current.y))
      e.preventDefault()
    }
    function onTouchEnd() {
      if (!dragging.current) return
      dragging.current = false
      setPos(p => { if (p) localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); return p })
    }
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    return () => { window.removeEventListener('touchmove', onTouchMove); window.removeEventListener('touchend', onTouchEnd) }
  }, [])

  function handleClick() {
    if (didDrag.current) return
    setOpen(v => !v)
  }

  if (!pos) return null

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
  const drawerW = isMobile ? window.innerWidth - 16 : 600
  const drawerH = isMobile
    ? Math.min(window.innerHeight * 0.75, window.innerHeight - 80)
    : Math.min(window.innerHeight * 0.7, 500)
  let drawerLeft = isMobile ? 8 : pos.x - drawerW - 8
  if (!isMobile) {
    if (drawerLeft < 8) drawerLeft = pos.x + BTN_SIZE + 8
    if (drawerLeft + drawerW > window.innerWidth - 8) drawerLeft = window.innerWidth - drawerW - 8
  }
  let drawerTop = isMobile
    ? window.innerHeight - drawerH - 72
    : pos.y
  if (!isMobile && drawerTop + drawerH > window.innerHeight - 8) drawerTop = window.innerHeight - drawerH - 8

  return (
    <>
      <button
        ref={btnRef}
        onMouseDown={onMouseDown}
        onClick={handleClick}
        onTouchStart={onTouchStart}
        title="Minhas notas"
        style={{ left: pos.x, top: pos.y }}
        className={`fixed z-[300] w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-colors select-none ${open ? 'bg-[#3d6ae0]' : 'bg-[#4F7CFF] hover:bg-[#3d6ae0]'}`}
        >
        {open
          ? <X size={18} className="text-white" />
          : <StickyNote size={18} className="text-white" />}
      </button>

      {open && (
        <div
          style={{ left: drawerLeft, top: drawerTop, width: drawerW, height: drawerH }}
          className="fixed z-[299] bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden flex flex-col"
        >
          <NotasPanel compact />
        </div>
      )}
    </>
  )
}
