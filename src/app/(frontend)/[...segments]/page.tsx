import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ContentBlocks } from '@/components/ContentBlocks'
import { getPublicPages } from '@/lib/pages'
type Props = { params: Promise<{ segments: string[] }> }
async function findPage(segments: string[]) {
  const pages = await getPublicPages()
  return pages.docs.find((page) => page.path === `/${segments.join('/')}`)
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await findPage((await params).segments)
  return page ? { title: page.title } : {}
}
export default async function PublicPage({ params }: Props) {
  const page = await findPage((await params).segments)
  if (!page) notFound()
  return (
    <article>
      <header className="article-header">
        <p className="eyebrow">PG Deník</p>
        <h1>{page.title}</h1>
      </header>
      <ContentBlocks blocks={page.content} />
    </article>
  )
}
