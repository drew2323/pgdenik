import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TableOfContents } from '@/components/TableOfContents'

const richText = (children: Array<Record<string, unknown>>) => ({
  blockType: 'richText' as const,
  body: { root: { type: 'root', children, direction: null, format: '', indent: 0, version: 1 } },
})
const heading = (tag: 'h2' | 'h3', anchor: string, text: string) => ({
  type: 'heading', tag, anchor, children: [{ type: 'text', text, version: 1 }], version: 1,
})

describe('TableOfContents', () => {
  it('renders nested links from article headings without duplicating child text in the parent item', () => {
    const blocks = [richText([
      heading('h2', 'HObecne', 'Obecné tipy'),
      heading('h2', 'HProfil', 'Profil Dne'),
      heading('h3', 'HAtributy', 'Atributy, kterých si u stoupáků všímat'),
      heading('h3', 'HDalsi', 'Další atributy profilu dne'),
    ])]

    const html = renderToStaticMarkup(<TableOfContents blocks={blocks as never} />)

    expect(html).toContain('Obsah stránky')
    expect(html).toContain('<a href="#HProfil">Profil Dne</a><ol><li><a href="#HAtributy">')
    expect(html.match(/Atributy, kterých si u stoupáků všímat/g)).toHaveLength(1)
    expect(html.match(/Další atributy profilu dne/g)).toHaveLength(1)
  })

  it('does not render for a page with fewer than two headings', () => {
    const html = renderToStaticMarkup(<TableOfContents blocks={[richText([heading('h2', 'HOnly', 'Jediný')])] as never} />)
    expect(html).toBe('')
  })
})
