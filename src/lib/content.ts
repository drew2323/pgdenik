export type EmbedKind = 'youtube' | 'xcvid'

export function normalizePublicPath(input: string): string {
  let decoded: string
  try {
    decoded = decodeURIComponent(input)
  } catch {
    throw new Error('Neplatná cesta stránky.')
  }
  if (decoded.split('/').includes('..')) throw new Error('Neplatná cesta stránky.')
  const parts = decoded
    .split('/')
    .filter(Boolean)
    .map((part) =>
      part
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-|-$/g, ''),
    )
    .filter(Boolean)
  return parts.length ? `/${parts.join('/')}` : '/'
}

export function validateEmbedURL(kind: EmbedKind, input: string): string {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new Error('Zadejte podporovanou URL.')
  }
  if (url.protocol !== 'https:') throw new Error('Zadejte podporovanou HTTPS URL.')
  if (url.username || url.password) throw new Error('Zadejte podporovanou URL.')
  if (kind === 'youtube') {
    if (url.searchParams.getAll('v').length > 1)
      throw new Error('Zadejte podporovanou YouTube URL.')
    const id =
      url.hostname === 'youtu.be'
        ? url.pathname.match(/^\/([\w-]{11})\/?$/)?.[1]
        : ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(
              url.hostname,
            )
          ? url.pathname.startsWith('/embed/')
            ? url.pathname.split('/')[2]
            : url.searchParams.get('v')
          : null
    if (!id || !/^[\w-]{11}$/.test(id)) throw new Error('Zadejte podporovanou YouTube URL.')
    return `https://www.youtube-nocookie.com/embed/${id}`
  }
  if (url.hostname !== 'xcvid.com' && url.hostname !== 'www.xcvid.com') {
    throw new Error('Zadejte podporovanou XCvid URL.')
  }
  if (url.pathname === '/embed.php') {
    const ident = url.searchParams.get('ident')
    if (!ident || !/^[\p{L}\p{N}._:/-]+$/u.test(ident))
      throw new Error('Zadejte podporovanou XCvid URL.')
    const safe = new URL('https://xcvid.com/embed.php')
    safe.searchParams.set('ident', ident)
    for (const key of ['shadow', 'viewFrom', 'trackPilot']) {
      const value = url.searchParams.get(key)
      if (value && /^[\d,.-]+$/.test(value)) safe.searchParams.set(key, value)
    }
    safe.hash = /^#\d+$/.test(url.hash) ? url.hash : ''
    return safe.href
  }
  throw new Error('Zadejte podporovanou XCvid embed URL.')
}

export async function validateParentChange(
  pageId: string | undefined,
  parentId: string | null | undefined,
  parentLookup: (id: string) => Promise<string | null | undefined>,
): Promise<void> {
  if (!parentId) return
  if (pageId && parentId === pageId) throw new Error('Stránka nemůže být vlastním rodičem.')
  const visited = new Set<string>()
  let cursor: string | null | undefined = parentId
  while (cursor) {
    if (visited.has(cursor) || (pageId && cursor === pageId))
      throw new Error('Rodič by vytvořil cyklus.')
    visited.add(cursor)
    const next = await parentLookup(cursor)
    if (next === undefined) throw new Error('Vybraný rodič neexistuje.')
    cursor = next
  }
}
