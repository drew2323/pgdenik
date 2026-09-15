import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { normalizePublicPath, validateEmbedURL, validateParentChange } from '../lib/content'

const validateTree: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  if (!data) return data
  const id = originalDoc?.id ? String(originalDoc.id) : undefined
  const rawParent = typeof data.parent === 'object' ? data.parent?.id : data.parent
  const parent = rawParent ? String(rawParent) : null
  await validateParentChange(id, parent, async (candidate) => {
    try {
      const found = await req.payload.findByID({
        collection: 'pages',
        id: candidate,
        depth: 0,
        req,
      })
      const value = found.parent
      return value ? String(typeof value === 'object' ? value.id : value) : null
    } catch {
      return undefined
    }
  })
  if (data.path) data.path = normalizePublicPath(String(data.path))
  return data
}

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'path', '_status', 'parent', 'order'] },
  access: {
    read: ({ req }) => (req.user ? true : { _status: { equals: 'published' } }),
  },
  versions: { drafts: { autosave: false } },
  hooks: { beforeValidate: [validateTree] },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'path', type: 'text', required: true, unique: true, index: true },
    {
      name: 'menuTitle',
      type: 'text',
      admin: { description: 'Volitelný kratší název v navigaci.' },
    },
    { name: 'parent', type: 'relationship', relationTo: 'pages', index: true },
    { name: 'order', type: 'number', required: true, defaultValue: 0, index: true },
    { name: 'showInMenu', type: 'checkbox', required: true, defaultValue: true },
    { name: 'sourceURL', type: 'text', unique: true, index: true, admin: { readOnly: true } },
    {
      name: 'content',
      type: 'blocks',
      required: true,
      blocks: [
        {
          slug: 'richText',
          labels: { singular: 'Text', plural: 'Texty' },
          fields: [{ name: 'body', type: 'richText', required: true }],
        },
        {
          slug: 'image',
          labels: { singular: 'Obrázek', plural: 'Obrázky' },
          fields: [
            { name: 'image', type: 'upload', relationTo: 'media', required: true },
            { name: 'caption', type: 'text' },
          ],
        },
        {
          slug: 'youtube',
          labels: { singular: 'YouTube', plural: 'YouTube' },
          fields: [
            {
              name: 'url',
              type: 'text',
              required: true,
              validate: (value: unknown) => {
                try {
                  validateEmbedURL('youtube', String(value))
                  return true
                } catch (error) {
                  return (error as Error).message
                }
              },
            },
          ],
        },
        {
          slug: 'xcvid',
          labels: { singular: 'XCvid', plural: 'XCvid' },
          fields: [
            {
              name: 'url',
              type: 'text',
              required: true,
              validate: (value: unknown) => {
                try {
                  validateEmbedURL('xcvid', String(value))
                  return true
                } catch (error) {
                  return (error as Error).message
                }
              },
            },
          ],
        },
      ],
    },
  ],
}
