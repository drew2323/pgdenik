import Link from 'next/link'
import type { NavItem } from './Navigation'

export function ChildPageList({ items, pageID }: { items: NavItem[]; pageID: string }) {
  const children = items.filter((item) => item.parent === pageID)
  if (!children.length) return null

  return (
    <nav aria-labelledby="child-pages-heading" className="child-pages">
      <h2 id="child-pages-heading">Stránky v této sekci</h2>
      <ol>
        {children.map((child) => (
          <li key={child.id}>
            <Link href={child.path}>{child.title}</Link>
          </li>
        ))}
      </ol>
    </nav>
  )
}
