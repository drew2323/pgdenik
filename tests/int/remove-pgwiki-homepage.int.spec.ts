import { describe, expect, it } from 'vitest'

import { removePGWikiRecommendation } from '@/lib/remove-pgwiki-homepage'

const text = (value: string) => ({ text: value, type: 'text' })
const link = (url: string, label: string) => ({
  children: [text(label)],
  fields: { linkType: 'custom', url },
  type: 'link',
})
const paragraph = (...children: unknown[]) => ({ children, type: 'paragraph', version: 1 })

describe('removePGWikiRecommendation', () => {
  it('removes only the exact PGWiki recommendation paragraph', () => {
    const before = {
      root: {
        children: [
          paragraph(text('Ostatní obsah zůstává.')),
          paragraph(
            text('Pro ucelenější a objektivní informace o paraglidingu doporučuji\u00a0'),
            link('https://www.pgwiki.cz', 'PGWIKI.cz'),
            text('\u00a0a také '),
            link('https://forum.pgwiki.cz', 'PGWiki fórum'),
            text('.'),
          ),
        ],
        type: 'root',
      },
    }

    const result = removePGWikiRecommendation(before)

    expect(result).toEqual({
      changed: true,
      value: { root: { children: [paragraph(text('Ostatní obsah zůstává.'))], type: 'root' } },
    })
    expect(removePGWikiRecommendation(result.value)).toEqual({
      changed: false,
      value: result.value,
    })
  })

  it('does not remove similar paragraphs with different links', () => {
    const value = {
      root: {
        children: [
          paragraph(
            text('Pro ucelenější a objektivní informace o paraglidingu doporučuji '),
            link('https://example.com', 'PGWIKI.cz'),
            text(' a také '),
            link('https://forum.pgwiki.cz', 'PGWiki fórum'),
            text('.'),
          ),
        ],
        type: 'root',
      },
    }

    expect(removePGWikiRecommendation(value)).toEqual({ changed: false, value })
  })
})
