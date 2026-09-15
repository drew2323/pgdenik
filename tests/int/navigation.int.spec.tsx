import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getActiveBranchIDs, Navigation, type NavItem } from '@/components/Navigation'
import { ContentBlocks } from '@/components/ContentBlocks'
import { parseSourcePage, sourcePageToLexical } from '@/importer/parser'

vi.mock('next/navigation', () => ({ usePathname: () => '/renamed-child' }))
vi.mock('next/link', () => ({ default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} /> }))

const items: NavItem[] = [
  { id: 'root', title: 'Root', path: '/', parent: null },
  { id: 'parent', title: 'Parent', path: '/unrelated-parent-url', parent: 'root' },
  { id: 'child', title: 'Child', path: '/renamed-child', parent: 'parent' },
]

describe('CMS relationship navigation state', () => {
  it('derives the active branch from parent IDs rather than URL prefixes', () => {
    expect([...getActiveBranchIDs(items, '/renamed-child')]).toEqual(['child', 'parent', 'root'])
  })

  it('exposes the current page and visible active ancestors accessibly', () => {
    render(<Navigation items={items} />)

    expect(screen.getByRole('link', { name: 'Child' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Parent' }).getAttribute('aria-current')).toBe(
      'location',
    )
    expect(screen.getByRole('link', { name: 'Root' }).getAttribute('aria-current')).toBe(
      'location',
    )
  })
})

describe('imported fragment targets', () => {
  it('renders preserved heading anchors as DOM targets', () => {
    const parsed = parseSourcePage(
      '<div id="document-title"><h1>Page</h1></div><div id="xwikicontent"><h2 id="landing">Landing</h2></div>',
      'https://www.pgdenik.cz/xwiki/bin/view/Page/',
    )
    render(
      <ContentBlocks
        blocks={[
          { blockType: 'richText', body: sourcePageToLexical(parsed.page) },
        ] as never}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Landing' }).id).toBe('landing')
  })
})
