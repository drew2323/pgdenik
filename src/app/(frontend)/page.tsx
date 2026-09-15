import { notFound } from 'next/navigation'
import { ContentBlocks } from '@/components/ContentBlocks'
import { getPublicPages } from '@/lib/pages'

export default async function HomePage() {
  const result = await getPublicPages()
  const page = result.docs.find((doc) => doc.path === '/')
  if (!page) notFound()
  return (
    <article>
      <header className="article-header">
        <p className="eyebrow">Paraglidingový zápisník</p>
        <h1>{page.title}</h1>
      </header>
      <ContentBlocks blocks={page.content} />
    </article>
  )
}
