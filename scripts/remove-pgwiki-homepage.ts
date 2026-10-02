import 'dotenv/config'
import { getPayload } from 'payload'

import config from '../src/payload.config'
import { removePGWikiRecommendation } from '../src/lib/remove-pgwiki-homepage'
import type { Page } from '../src/payload-types'

async function run() {
  const apply = process.argv.includes('--apply')
  const payload = await getPayload({ config })
  try {
    const result = await payload.find({
      collection: 'pages',
      depth: 0,
      draft: false,
      limit: 2,
      where: { path: { equals: '/' } },
    })
    if (result.docs.length !== 1)
      throw new Error(`Expected one homepage, found ${result.docs.length}`)

    const page = result.docs[0]
    let changedBlocks = 0
    const content = page.content.map((block) => {
      if (block.blockType !== 'richText') return block
      const transformed = removePGWikiRecommendation(block.body)
      if (!transformed.changed) return block
      changedBlocks += 1
      return { ...block, body: transformed.value }
    }) as Page['content']

    if (changedBlocks > 1)
      throw new Error(`Expected at most one changed block, found ${changedBlocks}`)
    if (changedBlocks === 0) {
      console.log('PGWIKI_RECOMMENDATION_ALREADY_ABSENT')
      return
    }
    if (!apply) {
      console.log('PGWIKI_RECOMMENDATION_WOULD_REMOVE')
      return
    }

    await payload.update({
      collection: 'pages',
      data: { content },
      depth: 0,
      draft: false,
      id: page.id,
    })
    console.log('PGWIKI_RECOMMENDATION_REMOVED')
  } finally {
    await payload.db.destroy?.()
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
