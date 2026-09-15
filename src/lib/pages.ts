import { connection } from 'next/server'
import { getPayload } from 'payload'

import config from '@/payload.config'
import type { NavItem } from '@/components/Navigation'

export function legacySegmentsMatchSourceURL(segments: string[], sourceURL: string): boolean {
  try {
    const url = new URL(sourceURL)
    if (url.origin !== 'https://www.pgdenik.cz' || !url.pathname.startsWith('/xwiki/bin/view/'))
      return false
    const sourceSegments = decodeURIComponent(url.pathname.slice('/xwiki/bin/view/'.length))
      .split('/')
      .filter(Boolean)
    // The App-Router catch-all may pass segments URL-encoded (e.g. spaces and
    // non-ASCII) while the stored sourceURL is decoded here; normalize both
    // sides before comparing so legacy URLs with spaces still redirect.
    const decodedIncoming = segments.map((segment) => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
    return (
      sourceSegments.length === decodedIncoming.length &&
      sourceSegments.every((segment, index) => segment === decodedIncoming[index])
    )
  } catch {
    return false
  }
}

export async function getPublicPages() {
  // Payload uses a direct database adapter, so explicitly keep CMS reads out of
  // the build-time static shell. Published edits must appear without a rebuild.
  await connection()
  const payload = await getPayload({ config })

  return payload.find({
    collection: 'pages',
    depth: 1,
    draft: false,
    limit: 1000,
    overrideAccess: false,
    sort: 'order',
    where: { _status: { equals: 'published' } },
  })
}

export async function getNavigation(): Promise<NavItem[]> {
  const result = await getPublicPages()

  return result.docs
    .filter((page) => page.showInMenu)
    .map((page) => ({
      id: String(page.id),
      title: page.menuTitle || page.title,
      path: page.path,
      parent: page.parent
        ? String(typeof page.parent === 'object' ? page.parent.id : page.parent)
        : null,
    }))
}
