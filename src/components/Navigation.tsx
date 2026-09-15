'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
export type NavItem = { id: string; title: string; path: string; parent: string | null }
export function getActiveBranchIDs(items: NavItem[], pathname: string): Set<string> {
  const byID = new Map(items.map((item) => [item.id, item]))
  const current = items.find((item) => item.path === pathname)
  const active = new Set<string>()
  let cursor = current
  while (cursor && !active.has(cursor.id)) {
    active.add(cursor.id)
    cursor = cursor.parent ? byID.get(cursor.parent) : undefined
  }
  return active
}
function Branch({
  activeIDs,
  item,
  items,
  close,
}: {
  activeIDs: Set<string>
  item: NavItem
  items: NavItem[]
  close: () => void
}) {
  const children = items.filter((x) => x.parent === item.id)
  const active = activeIDs.has(item.id) && !children.some((child) => activeIDs.has(child.id))
  const branch = activeIDs.has(item.id)
  const [expanded, setExpanded] = useState(branch)
  const shown = expanded || branch
  const groupId = `branch-${item.id}`
  return (
    <li>
      <div className="tree-row">
        {children.length ? (
          <button
            aria-controls={groupId}
            aria-expanded={shown}
            aria-label={`${shown ? 'Sbalit' : 'Rozbalit'} ${item.title}`}
            className="branch-toggle"
            onClick={() => setExpanded((value) => !value)}
          >
            {shown ? '−' : '+'}
          </button>
        ) : (
          <span className="branch-space" />
        )}
        <Link
          aria-current={active ? 'page' : branch ? 'location' : undefined}
          data-active-branch={branch ? 'true' : undefined}
          href={item.path}
          onClick={close}
        >
          {item.title}
        </Link>
      </div>
      {children.length > 0 && shown && (
        <ul id={groupId}>
          {children.map((child) => (
            <Branch activeIDs={activeIDs} close={close} item={child} items={items} key={child.id} />
          ))}
        </ul>
      )}
    </li>
  )
}
export function Navigation({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false)
  const [mobile, setMobile] = useState(false)
  const pathname = usePathname()
  const activeIDs = getActiveBranchIDs(items, pathname)
  const panel = useRef<HTMLElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!window.matchMedia) return
    const query = window.matchMedia('(max-width: 800px)')
    const update = () => setMobile(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (!open) return
    panel.current?.focus()
    document.body.classList.add('menu-open')
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('keydown', escape)
      document.body.classList.remove('menu-open')
    }
  }, [open])
  useEffect(() => {
    if (!open) return
    const containFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !panel.current) return
      const focusable = [
        ...panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      ]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', containFocus)
    return () => document.removeEventListener('keydown', containFocus)
  }, [open])
  const close = () => setOpen(false)
  const dismiss = () => {
    close()
    trigger.current?.focus()
  }
  return (
    <>
      <button
        aria-controls="site-navigation"
        aria-expanded={open}
        className="menu-button"
        onClick={() => setOpen(!open)}
        ref={trigger}
      >
        Menu <span aria-hidden="true">☰</span>
      </button>
      {open && <button aria-label="Zavřít menu" className="menu-scrim" onClick={dismiss} />}
      <aside
        aria-hidden={mobile && !open ? true : undefined}
        aria-label="Menu stránek"
        aria-modal={open || undefined}
        className={open ? 'navigation is-open' : 'navigation'}
        id="site-navigation"
        inert={mobile && !open ? true : undefined}
        ref={panel}
        role={open ? 'dialog' : undefined}
        tabIndex={-1}
      >
        <div className="brand">
          <Link href="/" onClick={close}>
            PG <span>Deník</span>
          </Link>
          <small>Poznámky z oblohy</small>
        </div>
        <nav aria-label="Hlavní navigace">
          <ul className="tree">
            {items
              .filter((x) => !x.parent)
              .map((item) => (
                <Branch activeIDs={activeIDs} close={close} item={item} items={items} key={item.id} />
              ))}
          </ul>
        </nav>
        <p className="nav-note">Osobní zápisník o létání, počasí a rozhodování.</p>
      </aside>
    </>
  )
}
