import { notFound, permanentRedirect } from 'next/navigation'
import { getPublicPages, legacySegmentsMatchSourceURL } from '@/lib/pages'

export default async function LegacyXWikiRedirect({
  params,
}: {
  params: Promise<{ legacy: string[] }>
}) {
  const { legacy } = await params
  const pages = await getPublicPages()
  const page = pages.docs.find(
    (candidate) =>
      candidate.sourceURL && legacySegmentsMatchSourceURL(legacy, candidate.sourceURL),
  )
  if (!page) notFound()
  permanentRedirect(page.path)
}
