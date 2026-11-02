import type { Page } from '@/payload-types'

type Node = {
  type?: string
  text?: string
  anchor?: string
  fields?: { url?: string }
  children?: Node[]
}
const textOf = (node: Node): string => node.text ?? (node.children || []).map(textOf).join('')
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim()

export function withoutLegacyTOC(blocks: Page['content']): Page['content'] {
  const first = blocks?.[0]
  if (first?.blockType !== 'richText') return blocks
  const leading = first.body.root.children[0] as Node | undefined
  if (leading?.type !== 'list') return blocks
  const headings: Node[] = []
  const collect = (node: Node) => {
    if (node.type === 'heading') headings.push(node)
    else node.children?.forEach(collect)
  }
  for (const block of blocks || []) {
    if (block.blockType === 'richText') collect(block.body.root as Node)
  }
  if (headings.length < 2 || headings.some((h) => h.anchor && !h.anchor.startsWith('H')))
    return blocks
  const links: Node[] = []
  const onlyLinks = (node: Node): boolean => {
    if (node.type === 'link') {
      links.push(node)
      return Boolean(node.fields?.url?.startsWith('#H'))
    }
    if (node.type === 'text') return !normalize(node.text || '')
    return (
      ['list', 'listitem'].includes(node.type || '') &&
      Boolean(node.children?.length) &&
      node.children!.every(onlyLinks)
    )
  }
  if (!onlyLinks(leading)) return blocks
  const unique = [...new Set(links.map((link) => link.fields?.url))]
  if (
    unique.length !== headings.length ||
    headings.some((h, i) => h.anchor && unique[i] !== `#${h.anchor}`)
  )
    return blocks
  const targets = new Map(unique.map((url, i) => [url, headings[i]]))
  if (
    links.some((link) => {
      const heading = targets.get(link.fields?.url)!
      // XWiki's empty H heading used the page title as its generated TOC label.
      return (
        !(heading.anchor === 'H' && !textOf(heading)) &&
        normalize(textOf(link)) !== normalize(textOf(heading))
      )
    })
  )
    return blocks
  const anchors = new Map(headings.map((h, i) => [h, unique[i]!.slice(1)]))
  const restoreAnchors = (node: Node): Node => ({
    ...node,
    ...(node.type === 'heading' && !node.anchor ? { anchor: anchors.get(node) } : {}),
    ...(node.children ? { children: node.children.map(restoreAnchors) } : {}),
  })
  const cleaned = [
    {
      ...first,
      body: {
        ...first.body,
        root: { ...first.body.root, children: first.body.root.children.slice(1) },
      },
    },
    ...blocks!.slice(1),
  ]
  return cleaned.map((block) =>
    block.blockType === 'richText'
      ? {
          ...block,
          body: {
            ...block.body,
            root: restoreAnchors(block.body.root as Node) as typeof block.body.root,
          },
        }
      : block,
  )
}
