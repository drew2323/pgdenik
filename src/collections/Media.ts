import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    { name: 'sourceURL', type: 'text', unique: true, index: true, admin: { readOnly: true } },
  ],
  upload: true,
}
