import { describe, expect, it } from 'vitest'

import { normalizePublicPath, validateEmbedURL, validateParentChange } from '@/lib/content'
import { Pages } from '@/collections/Pages'
import { legacySegmentsMatchSourceURL } from '@/lib/pages'

describe('content model', () => {
  it('limits anonymous reads to published pages and exposes all editable block types', () => {
    const read = Pages.access?.read
    expect(typeof read).toBe('function')
    const checkRead = read as (args: { req: { user: unknown } }) => unknown
    expect(checkRead({ req: { user: null } })).toEqual({ _status: { equals: 'published' } })
    expect(checkRead({ req: { user: { id: 1 } } })).toBe(true)
    const content = Pages.fields.find((field) => 'name' in field && field.name === 'content')
    expect(content && 'blocks' in content ? content.blocks.map((block) => block.slug) : []).toEqual(
      ['richText', 'image', 'youtube', 'xcvid'],
    )
  })
  it.each([
    [
      'youtube',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    ],
    [
      'youtube',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    ],
    [
      'youtube',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    ],
    [
      'xcvid',
      'https://xcvid.com/embed.php?ident=david/1.2.2021/10:30&shadow=1',
      'https://xcvid.com/embed.php?ident=david%2F1.2.2021%2F10%3A30&shadow=1',
    ],
  ] as const)('accepts and normalizes %s URLs', (kind, input, expected) => {
    expect(validateEmbedURL(kind, input)).toBe(expected)
  })

  it.each([
    ['youtube', 'https://youtu.be/dQw4w9WgXcQ/extra'],
    ['youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&v=aaaaaaaaaaa'],
    ['xcvid', 'https://xcvid.com/123?redirect=https://evil.test'],
    ['xcvid', 'https://xcvid.com/123'],
    ['xcvid', 'https://user:pass@xcvid.com/123'],
  ] as const)('rejects ambiguous %s URLs', (kind, input) => {
    expect(() => validateEmbedURL(kind, input)).toThrow(/podporovan/)
  })

  it.each([
    ['youtube', 'https://evil.test/watch?v=dQw4w9WgXcQ'],
    ['youtube', 'javascript:alert(1)'],
    ['xcvid', 'https://xcvid.com.evil.test/123'],
    ['xcvid', 'https://xcvid.com/123"><script>'],
  ] as const)('rejects unsafe %s URLs', (kind, input) => {
    expect(() => validateEmbedURL(kind, input)).toThrow(/podporovan/)
  })

  it('normalizes stable public paths without allowing traversal', () => {
    expect(normalizePublicPath('/Vybaveni/Kridla/')).toBe('/vybaveni/kridla')
    expect(() => normalizePublicPath('/../admin')).toThrow(/cesta/i)
  })

  it('matches legacy XWiki view URLs without accepting lookalike paths', () => {
    const sourceURL = 'https://www.pgdenik.cz/xwiki/bin/view/Tipy%20a%20triky/Alpsk%C3%A9%20l%C3%A9t%C3%A1n%C3%AD/'
    expect(legacySegmentsMatchSourceURL(['Tipy a triky', 'Alpské létání'], sourceURL)).toBe(true)
    // The App Router may deliver segments still percent-encoded (spaces and
    // non-ASCII); these must normalise to the decoded source URL too.
    expect(
      legacySegmentsMatchSourceURL(
        ['Tipy%20a%20triky', 'Alpsk%C3%A9%20l%C3%A9t%C3%A1n%C3%AD'],
        sourceURL,
      ),
    ).toBe(true)
    expect(legacySegmentsMatchSourceURL(['Tipy a triky', 'Other'], sourceURL)).toBe(false)
    expect(legacySegmentsMatchSourceURL(['admin'], 'https://evil.test/xwiki/bin/view/admin/')).toBe(false)
  })

  it('rejects self-parenting, descendants and missing parents', async () => {
    const ancestors = new Map<string, string | null>([
      ['root', null],
      ['child', 'root'],
      ['leaf', 'child'],
    ])
    const lookup = async (id: string) => (ancestors.has(id) ? ancestors.get(id)! : undefined)

    await expect(validateParentChange('child', 'child', lookup)).rejects.toThrow(/rodi/i)
    await expect(validateParentChange('root', 'leaf', lookup)).rejects.toThrow(/cykl/i)
    await expect(validateParentChange('leaf', 'missing', lookup)).rejects.toThrow(/neexistuje/i)
    await expect(validateParentChange('leaf', 'root', lookup)).resolves.toBeUndefined()
  })
})
