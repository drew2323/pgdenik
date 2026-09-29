import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getActiveBranchIDs, Navigation, type NavItem } from '@/components/Navigation'
import { pagesToNavigation } from '@/lib/pages'
import { ChildPageList } from '@/components/ChildPageList'
import { ContentBlocks } from '@/components/ContentBlocks'
import { parseSourcePage, sourcePageToLexical } from '@/importer/parser'

vi.mock('next/navigation', () => ({ usePathname: () => '/renamed-child' }))
vi.mock('next/link', () => ({ default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} /> }))

const items: NavItem[] = [
  { id: 'root', title: 'Root', path: '/', parent: null, order: 0 },
  { id: 'parent', title: 'Parent', path: '/unrelated-parent-url', parent: 'root', order: 0 },
  { id: 'child', title: 'Child', path: '/renamed-child', parent: 'parent', order: 0 },
]

describe('CMS relationship navigation state', () => {
  it('sorts every sibling group by the explicit CMS order', () => {
    const navigation = pagesToNavigation([
      { id: 'root', title: 'Root', menuTitle: 'Root', path: '/', parent: null, order: 0, showInMenu: true },
      { id: 'second', title: 'Second', menuTitle: 'Second', path: '/second', parent: { id: 'root' }, order: 1, showInMenu: true },
      { id: 'first', title: 'First', menuTitle: 'First', path: '/first', parent: { id: 'root' }, order: 0, showInMenu: true },
    ] as never)

    expect(navigation.map((item) => item.title)).toEqual(['Root', 'First', 'Second'])
  })
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

describe('page child navigation', () => {
  it('visibly lists direct children in configured sibling order', () => {
    render(
      <ChildPageList
        items={[
          { id: 'later', title: '31.5.2021 Čerták', path: '/analyzy/31-5', parent: 'analysis' },
          { id: 'first', title: '8.5.2021 Blatná', path: '/analyzy/8-5', parent: 'analysis' },
        ]}
        pageID="analysis"
      />,
    )

    const childNavigation = screen.getByRole('navigation', { name: 'Stránky v této sekci' })
    const links = Array.from(childNavigation.querySelectorAll('a')).map((link) => link.textContent)
    expect(screen.getByRole('heading', { name: 'Stránky v této sekci' })).toBeTruthy()
    expect(links).toEqual(['31.5.2021 Čerták', '8.5.2021 Blatná'])
  })

  it('renders nothing for a leaf page', () => {
    const { container } = render(<ChildPageList items={items} pageID="child" />)
    expect(container.innerHTML).toBe('')
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
