import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { getPayload } from 'payload'
import sharp from 'sharp'
import config from '../../src/payload.config.js'
import type { Page } from '../../src/payload-types.js'

export const fixture = {
  childPath: '/fixture-child',
  childSourceURL: 'https://www.pgdenik.cz/xwiki/bin/view/Fixture/Child/',
  parentPath: '/fixture-parent-unrelated',
  parentSourceURL: 'fixture://parent',
  mediaSourceURL: 'fixture://image',
}

const lexical = (
  text: string,
): Extract<Page['content'][number], { blockType: 'richText' }>['body'] => ({
  root: {
    children: [
      {
        children: [{ detail: 0, format: 0, mode: 'normal', style: '', text, type: 'text', version: 1 }],
        direction: null,
        format: '',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        type: 'paragraph',
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
})

export async function seedContentFixture() {
  const payload = await getPayload({ config })
  const directory = await mkdtemp(path.join(tmpdir(), 'pgdenik-e2e-'))
  const filePath = path.join(directory, 'fixture.png')
  await sharp({ create: { background: '#176b63', channels: 4, height: 80, width: 120 } })
    .png()
    .toFile(filePath)
  try {
    let media = (
      await payload.find({
        collection: 'media',
        depth: 0,
        limit: 1,
        where: { sourceURL: { equals: fixture.mediaSourceURL } },
      })
    ).docs[0]
    if (!media)
      media = await payload.create({
        collection: 'media',
        data: { alt: 'Fixture paraglider', sourceURL: fixture.mediaSourceURL },
        filePath,
      })

    let parent = (
      await payload.find({
        collection: 'pages',
        depth: 0,
        limit: 1,
        where: { sourceURL: { equals: fixture.parentSourceURL } },
      })
    ).docs[0]
    const parentData = {
      _status: 'published' as const,
      content: [{ blockType: 'richText' as const, body: lexical('Fixture parent') }],
      menuTitle: 'Fixture parent',
      order: 900,
      parent: null,
      path: fixture.parentPath,
      showInMenu: true,
      sourceURL: fixture.parentSourceURL,
      title: 'Fixture parent',
    }
    parent = parent
      ? await payload.update({ collection: 'pages', data: parentData, id: parent.id })
      : await payload.create({ collection: 'pages', data: parentData })

    const childData = {
      _status: 'published' as const,
      content: [
        { blockType: 'richText' as const, body: lexical('Fixture article text') },
        { blockType: 'image' as const, image: media.id, caption: 'Fixture caption' },
        { blockType: 'youtube' as const, url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' },
        { blockType: 'xcvid' as const, url: 'https://xcvid.com/embed.php?ident=fixture%2Fflight' },
      ],
      menuTitle: 'Fixture child',
      order: 7,
      parent: parent.id,
      path: fixture.childPath,
      showInMenu: true,
      sourceURL: fixture.childSourceURL,
      title: 'Fixture child',
    }
    const existing = (
      await payload.find({
        collection: 'pages',
        depth: 0,
        limit: 1,
        where: { sourceURL: { equals: fixture.childSourceURL } },
      })
    ).docs[0]
    const child = existing
      ? await payload.update({ collection: 'pages', data: childData, id: existing.id })
      : await payload.create({ collection: 'pages', data: childData })
    return { child, media, parent }
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
}

export async function cleanupContentFixture() {
  const payload = await getPayload({ config })
  await payload.delete({
    collection: 'pages',
    where: { sourceURL: { in: [fixture.childSourceURL, fixture.parentSourceURL] } },
  })
  await payload.delete({ collection: 'media', where: { sourceURL: { equals: fixture.mediaSourceURL } } })
}
