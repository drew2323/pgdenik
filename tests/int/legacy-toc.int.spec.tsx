import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ContentBlocks } from '@/components/ContentBlocks'
import { TableOfContents } from '@/components/TableOfContents'
import { parseSourcePage, sourcePageToLexical } from '@/importer/parser'

const text = (value: string) => ({ type: 'text', text: value, version: 1 })
const node = (type: string, children: unknown[], extra = {}) => ({
  type,
  children,
  version: 1,
  direction: null,
  format: '',
  indent: 0,
  ...extra,
})
const link = (anchor: string, label: string) =>
  node('link', [text(label)], {
    fields: { linkType: 'custom', url: `#${anchor}`, newTab: false },
    version: 3,
  })
const list = (children: unknown[]) =>
  node('list', children, { listType: 'bullet', tag: 'ul', start: 1 })
const item = (children: unknown[]) => node('listitem', children, { value: 1 })
const heading = (anchor: string, label: string) =>
  node('heading', [text(label)], { anchor, tag: 'h2' })
const toc = list([
  item([
    link('HParent', 'Parent'),
    link('HChild', 'Child'),
    list([item([link('HChild', 'Child')])]),
  ]),
])
const body = [
  node('paragraph', [text('Tato sekce pokrývá…')]),
  heading('HParent', 'Parent'),
  heading('HChild', 'Child'),
]
const blocks = (leading = toc) => [
  { blockType: 'richText', body: { root: node('root', [leading, ...structuredClone(body)]) } },
]
const render = (content: unknown) =>
  renderToStaticMarkup(
    <>
      <TableOfContents blocks={content as never} />
      <ContentBlocks blocks={content as never} />
    </>,
  )

describe('historical generated TOC', () => {
  it('renders stored malformed TOC content directly after the new TOC without changing stored nodes', () => {
    const content = blocks()
    const before = JSON.stringify(content)
    const html = render(content)
    expect(html).toContain('class="prose"><p>Tato sekce pokrývá…</p>')
    expect(html.match(/href="#HChild"/g)).toHaveLength(1)
    expect(html).toContain('<h2 id="HChild">Child</h2>')
    expect(JSON.stringify(content)).toBe(before)
  })

  it('recovers missing generated heading anchors only from a complete matching TOC', () => {
    const content = blocks()
    for (const child of content[0].body.root.children as Array<Record<string, unknown>>) {
      if (child.type === 'heading') delete child.anchor
    }
    const html = render(content)
    expect(html).toContain('<h2 id="HChild">Child</h2>')
    expect(html.match(/href="#HChild"/g)).toHaveLength(1)
    expect(html).not.toContain('<ul')
  })

  it.each([
    list([item([text('Useful advice')]), item([link('HChild', 'Child')])]),
    list([item([link('HChild', 'Child')]), item([link('HParent', 'Parent')])]),
    list([item([link('HParent', 'Read parent')]), item([link('HChild', 'Child')])]),
    list([item([link('HChild', 'Child')])]),
  ])('preserves authored lists and partial/reordered/relabeled anchor lists', (leading) => {
    expect(render(blocks(leading))).toContain('<ul')
  })

  it('preserves an authored multi-link item during import', () => {
    const parsed = parseSourcePage(
      '<div id="xwikicontent"><ul><li><a href="#HParent">Parent</a><a href="#HChild">Child</a></li></ul><h1 class="wikigeneratedid" id="HParent">Parent</h1><h2 class="wikigeneratedid" id="HChild">Child</h2></div>',
      'https://www.pgdenik.cz/xwiki/bin/view/Tipy/Test/',
    )
    expect(JSON.stringify(sourcePageToLexical(parsed.page))).toContain('"type":"list"')
  })

  it('removes the same malformed list during import, preserving following content', () => {
    const source =
      '<ul><li><a href="#HParent">Parent</a><a href="#HChild">Child</a><ul><li><a href="#HChild">Child</a></li></ul></li></ul>'
    const parsed = parseSourcePage(
      `<div id="xwikicontent">${source}<p>Keep</p><h1 class="wikigeneratedid" id="HParent">Parent</h1><h2 class="wikigeneratedid" id="HChild">Child</h2></div>`,
      'https://www.pgdenik.cz/xwiki/bin/view/Tipy/Test/',
    )
    const serialized = JSON.stringify(sourcePageToLexical(parsed.page))
    expect(serialized).not.toContain('"type":"list"')
    expect(serialized).toContain('Keep')
    expect(serialized).toContain('"anchor":"HChild"')
  })
})
