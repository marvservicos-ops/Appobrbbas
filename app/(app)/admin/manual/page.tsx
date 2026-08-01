import fs from 'fs'
import path from 'path'
import MarkdownView from './MarkdownView'

export default function AdminManualPage() {
  const filePath = path.join(process.cwd(), 'MANUAL.md')
  const markdown = fs.readFileSync(filePath, 'utf-8')

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
      <MarkdownView markdown={markdown} />
    </div>
  )
}
