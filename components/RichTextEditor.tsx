'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { useEffect, useRef } from 'react'
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Undo, Redo } from 'lucide-react'

const COLORS = ['#0F172A', '#4F7CFF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#64748B']

interface Props {
  value: string
  onChange: (html: string) => void
  insertRef?: React.MutableRefObject<((text: string) => void) | null>
  placeholder?: string
}

function ToolbarBtn({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      className={`w-7 h-7 flex items-center justify-center rounded text-sm transition-colors
        ${active ? 'bg-[#4F7CFF] text-white' : 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]'}`}
    >
      {children}
    </button>
  )
}

export default function RichTextEditor({ value, onChange, insertRef, placeholder }: Props) {
  const internalChange = useRef(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const editor = useEditor({
    extensions: [StarterKit, Underline, TextStyle, Color],
    content: value || '',
    onUpdate: ({ editor }) => {
      internalChange.current = true
      onChangeRef.current(editor.getHTML())
    },
    onCreate: ({ editor }) => {
      if (insertRef) {
        insertRef.current = (text: string) => {
          editor.chain().focus().insertContent(text).run()
        }
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[140px] px-3 py-2 text-sm text-[#374151] leading-relaxed',
      },
    },
  })

  // Sync only when value changes from outside (not from typing inside the editor)
  useEffect(() => {
    if (!editor) return
    if (internalChange.current) {
      internalChange.current = false
      return
    }
    const current = editor.getHTML()
    if (value !== current) {
      editor.commands.setContent(value || '')
    }
  }, [value, editor])

  if (!editor) return null

  return (
    <div className="border border-[#E2E8F0] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#4F7CFF]/20 focus-within:border-[#4F7CFF] transition-all">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex-wrap">
        <ToolbarBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={13} />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={13} />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon size={13} />
        </ToolbarBtn>

        <div className="w-px h-5 bg-[#E2E8F0] mx-1" />

        <ToolbarBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={13} />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={13} />
        </ToolbarBtn>

        <div className="w-px h-5 bg-[#E2E8F0] mx-1" />

        {/* Color picker */}
        <div className="flex items-center gap-1">
          {COLORS.map(color => (
            <button
              key={color}
              type="button"
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().setColor(color).run() }}
              title={color}
              className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-110
                ${editor.isActive('textStyle', { color }) ? 'border-[#0F172A] scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: color }}
            />
          ))}
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetColor().run() }}
            title="Cor padrão"
            className="w-4 h-4 rounded-full border border-[#E2E8F0] bg-white text-[8px] flex items-center justify-center text-[#94A3B8] hover:bg-[#F1F5F9]"
          >
            ✕
          </button>
        </div>

        <div className="w-px h-5 bg-[#E2E8F0] mx-1" />

        <ToolbarBtn onClick={() => editor.chain().focus().undo().run()}>
          <Undo size={13} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().redo().run()}>
          <Redo size={13} />
        </ToolbarBtn>
      </div>

      {/* Editor area */}
      <div className="relative bg-white">
        {editor.isEmpty && placeholder && (
          <p className="absolute top-2 left-3 text-sm text-[#CBD5E1] pointer-events-none select-none">{placeholder}</p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
