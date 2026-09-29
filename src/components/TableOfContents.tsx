import type { Page } from '@/payload-types'

type Heading = { anchor: string; level: number; text: string; children: Heading[] }
type LexicalNode = { anchor?: unknown; children?: LexicalNode[]; tag?: unknown; text?: unknown; type?: unknown }

function textOf(node: LexicalNode): string {
  if (typeof node.text === 'string') return node.text
  return (node.children || []).map(textOf).join('')
}

function collect(nodes: LexicalNode[], headings: Heading[]) {
  for (const node of nodes) {
    if (node.type === 'heading' && typeof node.anchor === 'string' && /^h[2-6]$/.test(String(node.tag))) {
      headings.push({ anchor: node.anchor, level: Number(String(node.tag).slice(1)), text: textOf(node).trim(), children: [] })
    }
    if (node.type !== 'heading' && node.children) collect(node.children, headings)
  }
}

export function tableOfContentsFromBlocks(blocks: Page['content']): Heading[] {
  const flat: Heading[] = []
  for (const block of blocks || []) {
    if (block.blockType !== 'richText') continue
    const root = block.body?.root as unknown as LexicalNode | undefined
    collect(root?.children || [], flat)
  }
  if (flat.length < 2) return []

  const roots: Heading[] = []
  const stack: Heading[] = []
  for (const heading of flat) {
    while (stack.length && stack[stack.length - 1].level >= heading.level) stack.pop()
    if (stack.length) stack[stack.length - 1].children.push(heading)
    else roots.push(heading)
    stack.push(heading)
  }
  return roots
}

function Items({ items }: { items: Heading[] }) {
  return (
    <ol>
      {items.map((item) => (
        <li key={item.anchor}>
          <a href={`#${item.anchor}`}>{item.text}</a>
          {item.children.length > 0 && <Items items={item.children} />}
        </li>
      ))}
    </ol>
  )
}

export function TableOfContents({ blocks }: { blocks: Page['content'] }) {
  const items = tableOfContentsFromBlocks(blocks)
  if (!items.length) return null
  return (
    <nav aria-labelledby="table-of-contents-heading" className="table-of-contents">
      <h2 id="table-of-contents-heading">Obsah stránky</h2>
      <Items items={items} />
    </nav>
  )
}
