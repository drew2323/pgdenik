import Image from 'next/image'
import React from 'react'
import { RichText, type JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'
import { validateEmbedURL } from '@/lib/content'
import type { Page } from '@/payload-types'

const richTextConverters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,
  heading: ({ node, nodesToJSX }) => {
    const anchored = node as typeof node & { anchor?: string }
    return React.createElement(
      node.tag,
      anchored.anchor ? { id: anchored.anchor } : undefined,
      nodesToJSX({ nodes: node.children }),
    )
  },
})
export function ContentBlocks({ blocks }: { blocks: Page['content'] }) {
  return (
    <>
      {blocks?.map((block, index) => {
        if (block.blockType === 'richText')
          return (
            <RichText
              className="prose"
              converters={richTextConverters}
              data={block.body}
              key={block.id || index}
            />
          )
        if (block.blockType === 'image' && typeof block.image === 'object' && block.image.url)
          return (
            <figure key={block.id || index}>
              <Image
                alt={block.image.alt}
                height={block.image.height || 900}
                src={block.image.url}
                width={block.image.width || 1400}
              />
              {block.caption && <figcaption>{block.caption}</figcaption>}
            </figure>
          )
        if (block.blockType === 'youtube' || block.blockType === 'xcvid') {
          try {
            return (
              <div className="responsive-embed" key={block.id || index}>
                <iframe
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  src={validateEmbedURL(block.blockType, block.url)}
                  title={block.blockType === 'youtube' ? 'YouTube video' : 'XCvid záznam letu'}
                />
              </div>
            )
          } catch {
            return (
              <p className="media-error" key={block.id || index}>
                Toto médium nelze bezpečně zobrazit.
              </p>
            )
          }
        }
        return null
      })}
    </>
  )
}
