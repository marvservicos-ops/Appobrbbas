'use client'

const DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g')

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(DIACRITICS_RE, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let rest = text
  let i = 0
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/
  while (rest.length) {
    const m = pattern.exec(rest)
    if (!m) { nodes.push(rest); break }
    if (m.index > 0) nodes.push(rest.slice(0, m.index))
    if (m[1] !== undefined) {
      const href = m[2]
      const internal = href.startsWith('#')
      nodes.push(
        internal
          ? <a key={`${keyPrefix}-${i++}`} href={href} className="text-blue-600 hover:underline">{m[1]}</a>
          : <a key={`${keyPrefix}-${i++}`} href={href} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{m[1]}</a>
      )
    } else if (m[3] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-${i++}`} className="font-semibold text-slate-900">{m[3]}</strong>)
    } else if (m[4] !== undefined) {
      nodes.push(<code key={`${keyPrefix}-${i++}`} className="px-1 py-0.5 rounded bg-slate-100 text-[13px] text-slate-800">{m[4]}</code>)
    }
    rest = rest.slice(m.index + m[0].length)
  }
  return nodes
}

export default function MarkdownView({ markdown }: { markdown: string }) {
  const lines = markdown.split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') { i++; continue }

    if (line.startsWith('# ')) {
      const text = line.slice(2).trim()
      blocks.push(<h1 key={key++} id={slugify(text)} className="text-2xl font-bold text-slate-900 mt-8 mb-3 scroll-mt-24">{renderInline(text, `h1-${key}`)}</h1>)
      i++; continue
    }
    if (line.startsWith('## ')) {
      const text = line.slice(3).trim()
      blocks.push(<h2 key={key++} id={slugify(text)} className="text-xl font-bold text-slate-900 mt-8 mb-3 pb-2 border-b border-slate-200 scroll-mt-24">{renderInline(text, `h2-${key}`)}</h2>)
      i++; continue
    }
    if (line.startsWith('### ')) {
      const text = line.slice(4).trim()
      blocks.push(<h3 key={key++} id={slugify(text)} className="text-base font-bold text-slate-900 mt-6 mb-2 scroll-mt-24">{renderInline(text, `h3-${key}`)}</h3>)
      i++; continue
    }
    if (line.startsWith('> ')) {
      const buf: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) { buf.push(lines[i].slice(2)); i++ }
      blocks.push(<blockquote key={key++} className="border-l-4 border-amber-300 bg-amber-50 text-amber-900 text-sm px-4 py-2 my-3 rounded-r">{renderInline(buf.join(' '), `bq-${key}`)}</blockquote>)
      continue
    }
    if (line.trim() === '---') { blocks.push(<hr key={key++} className="my-6 border-slate-200" />); i++; continue }

    if (line.trim().startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
        if (!/^:?-+:?$/.test(cells[0] || '')) rows.push(cells)
        i++
      }
      const [header, ...body] = rows
      blocks.push(
        <div key={key++} className="overflow-x-auto my-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50">
                {header.map((h, ci) => <th key={ci} className="text-left font-semibold text-slate-700 px-3 py-2 border border-slate-200">{renderInline(h, `th-${key}-${ci}`)}</th>)}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} className="odd:bg-white even:bg-slate-50/60">
                  {row.map((c, ci) => <td key={ci} className="px-3 py-2 border border-slate-200 align-top text-slate-700">{renderInline(c, `td-${key}-${ri}-${ci}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    if (/^\s*-\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*-\s+/, '')); i++ }
      blocks.push(
        <ul key={key++} className="list-disc pl-5 my-2 space-y-1 text-sm text-slate-700">
          {items.map((it, ii) => <li key={ii}>{renderInline(it, `li-${key}-${ii}`)}</li>)}
        </ul>
      )
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++ }
      blocks.push(
        <ol key={key++} className="list-decimal pl-5 my-2 space-y-1 text-sm text-slate-700">
          {items.map((it, ii) => <li key={ii}>{renderInline(it, `ol-${key}-${ii}`)}</li>)}
        </ol>
      )
      continue
    }

    const buf: string[] = [line]
    i++
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,3}\s|>\s|-\s|\d+\.\s|\|)/.test(lines[i]) && lines[i].trim() !== '---') {
      buf.push(lines[i]); i++
    }
    blocks.push(<p key={key++} className="text-sm text-slate-700 leading-relaxed my-2">{renderInline(buf.join(' '), `p-${key}`)}</p>)
  }

  return <div>{blocks}</div>
}
