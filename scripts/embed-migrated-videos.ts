import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const updates = [
  {
    path: '/analyzy-letu/analyzy-letu-tenerife-2020',
    videos: [
      { after: 2, url: 'https://youtu.be/B9r8JBq65xU' },
      { after: 8, url: 'https://youtu.be/MqbzqCz_hl0' },
      { after: 8, url: 'https://youtu.be/hmiYn517820' },
    ],
  },
  {
    path: '/meteo/predpoved-vs-realita/14-4-2021-rana---big-day-na-zafuk',
    videos: [{ after: 2, url: 'https://youtu.be/bOOiV3x4_0I' }],
  },
] as const

async function run() {
  const payload = await getPayload({ config })
  for (const update of updates) {
    const result = await payload.find({
      collection: 'pages',
      depth: 0,
      limit: 1,
      where: { path: { equals: update.path } },
    })
    const page = result.docs[0]
    if (!page) throw new Error(`Page not found: ${update.path}`)
    const expectedURLs = new Set(update.videos.map((video) => video.url))
    const current = page.content ?? []
    const withoutManagedVideos = current.filter(
      (block) => !(block.blockType === 'youtube' && expectedURLs.has(block.url as never)),
    )
    const byPosition = new Map<number, Array<{ blockType: 'youtube'; url: string }>>()
    for (const video of update.videos) {
      const entries = byPosition.get(video.after) ?? []
      entries.push({ blockType: 'youtube', url: video.url })
      byPosition.set(video.after, entries)
    }
    const content = withoutManagedVideos.flatMap((block, index) => [
      block,
      ...(byPosition.get(index) ?? []),
    ])
    await payload.update({
      collection: 'pages',
      id: page.id,
      depth: 0,
      data: { content },
    })
    console.log(JSON.stringify({ path: update.path, videoCount: update.videos.length }))
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
