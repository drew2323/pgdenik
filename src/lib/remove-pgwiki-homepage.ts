const recommendation =
  'Pro ucelenější a objektivní informace o paraglidingu doporučuji PGWIKI.cz a také PGWiki fórum.'
const recommendationURLs = new Set(['https://www.pgwiki.cz', 'https://forum.pgwiki.cz'])

type JSONRecord = Record<string, unknown>

function isRecord(value: unknown): value is JSONRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function collectText(value: unknown): string {
  if (!isRecord(value)) return ''
  const ownText = typeof value.text === 'string' ? value.text : ''
  const childText = Array.isArray(value.children) ? value.children.map(collectText).join('') : ''
  return ownText + childText
}

function collectURLs(value: unknown): string[] {
  if (!isRecord(value)) return []
  const fields = isRecord(value.fields) ? value.fields : undefined
  const ownURL = fields && typeof fields.url === 'string' ? [fields.url] : []
  const childURLs = Array.isArray(value.children) ? value.children.flatMap(collectURLs) : []
  return [...ownURL, ...childURLs]
}

function isRecommendationParagraph(value: unknown): boolean {
  if (!isRecord(value) || value.type !== 'paragraph') return false
  const normalizedText = collectText(value).replace(/\s+/gu, ' ').trim()
  const urls = collectURLs(value)
  return (
    normalizedText === recommendation &&
    urls.length === recommendationURLs.size &&
    urls.every((url) => recommendationURLs.has(url))
  )
}

export function removePGWikiRecommendation(value: unknown): {
  changed: boolean
  value: unknown
} {
  if (!isRecord(value) || !isRecord(value.root) || !Array.isArray(value.root.children))
    return { changed: false, value }

  const matches = value.root.children.filter(isRecommendationParagraph)
  if (matches.length > 1) throw new Error('Homepage contains multiple PGWiki recommendation paragraphs')
  if (matches.length === 0) return { changed: false, value }

  return {
    changed: true,
    value: {
      ...value,
      root: {
        ...value.root,
        children: value.root.children.filter((child) => !isRecommendationParagraph(child)),
      },
    },
  }
}
