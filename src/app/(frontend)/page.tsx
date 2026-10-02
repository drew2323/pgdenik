import { notFound } from 'next/navigation'
import { ContentBlocks } from '@/components/ContentBlocks'
import { ChildPageList } from '@/components/ChildPageList'
import { getPublicPages, pagesToChildItems } from '@/lib/pages'

export default async function HomePage() {
  const result = await getPublicPages()
  const page = result.docs.find((doc) => doc.path === '/')
  if (!page) notFound()
  return (
    <article>
      <header className="article-header">
        <p className="eyebrow">Osobní paraglidingový deník</p>
        <h1>{page.title}</h1>
      </header>
      <ContentBlocks blocks={page.content} />
      <ChildPageList items={pagesToChildItems(result.docs)} pageID={String(page.id)} />
    </article>
  )
}
