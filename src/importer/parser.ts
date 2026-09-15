import * as cheerio from 'cheerio'
import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { normalizePublicPath } from '../lib/content'
import { validateEmbedURL } from '../lib/content'

const SOURCE_ORIGIN = 'https://www.pgdenik.cz'
const VIEW_PREFIX = '/xwiki/bin/view/'

class ImportPolicyError extends Error {}

type FetchOptions = {
  attempts?: number
  fetchImpl?: typeof fetch
  headers?: HeadersInit
  lookup?: (hostname: string) => Promise<Array<{ address: string; family: number }>>
  maxBytes?: number
  maxRedirects?: number
  resourceType?: 'image' | 'page' | 'tree'
  timeoutMs?: number
}

export type PublicTreePage = {
  fullName: string
  parent: string
  sourceURL: string
  title: string
}

type TreeSummary = {
  fullName?: string
  parent?: string
  title?: string
  xwikiAbsoluteUrl?: string
  xwikiRelativeUrl?: string
  links?: Array<{ href?: string; rel?: string }>
}

type DiscoverOptions = FetchOptions & {
  maxPages?: number
  origin?: string
  rootSourceIDs?: string[]
}

const CHILDREN_REL = 'http://www.xwiki.org/rel/children'
export const PUBLIC_ROOT_SOURCE_IDS = [
  '07 Closecalls.WebHome',
  '10 Technologie.WebHome',
  'Analyzy letu.WebHome',
  'Mental Game.WebHome',
  'Meteo.WebHome',
  'Software.WebHome',
  'Tipy a triky.WebHome',
  'Zavody.WebHome',
]

function canonicalSourceURL(input: string, origin: string): string {
  const url = new URL(input, origin)
  if (url.hostname === new URL(origin).hostname && url.port === '443') url.port = ''
  assertAllowedURL(url, 'page')
  url.search = ''
  url.hash = ''
  return url.href.endsWith('/') ? url.href : `${url.href}/`
}

function childrenURL(fullName: string, origin: string): string {
  const parts = fullName.split('.')
  const page = parts.pop() || 'WebHome'
  const spaces = parts.map(encodeURIComponent).join('/spaces/')
  return `${origin}/xwiki/rest/wikis/pgdenik/spaces/${spaces}/pages/${encodeURIComponent(page)}/children`
}

export async function discoverPublicTree(
  options: DiscoverOptions = {},
): Promise<{ pages: PublicTreePage[]; warnings: string[] }> {
  const origin = options.origin ?? SOURCE_ORIGIN
  const maxPages = options.maxPages ?? 250
  const rootSourceIDs = new Set(options.rootSourceIDs ?? PUBLIC_ROOT_SOURCE_IDS)
  const root: PublicTreePage = {
    fullName: 'Main.WebHome',
    parent: '',
    sourceURL: `${origin}/xwiki/bin/view/Main/`,
    title: 'PG Deník.cz',
  }
  const pages = [root]
  const warnings: string[] = []
  const seen = new Set([root.fullName])
  const queue = [{ fullName: root.fullName, url: childrenURL(root.fullName, origin) }]

  while (queue.length) {
    const current = queue.shift()!
    let response: Response
    try {
      response = await fetchWithRetry(current.url, {
        ...options,
        headers: { accept: 'application/json', ...options.headers },
      })
    } catch (error) {
      warnings.push(
        `children-fetch:${current.fullName}:${error instanceof Error ? error.message : 'failed'}`,
      )
      continue
    }
    if (!response.ok) {
      warnings.push(`children-http:${current.fullName}:${response.status}`)
      continue
    }
    let summaries: TreeSummary[]
    try {
      const json = (await response.json()) as { pageSummaries?: TreeSummary[] }
      summaries = Array.isArray(json.pageSummaries) ? json.pageSummaries : []
    } catch {
      warnings.push(`children-json:${current.fullName}`)
      continue
    }
    for (const summary of summaries) {
      if (summary.parent && summary.parent !== current.fullName) continue
      if (
        current.fullName === root.fullName &&
        summary.fullName &&
        !rootSourceIDs.has(summary.fullName)
      )
        continue
      if (summary.fullName && !summary.fullName.endsWith('.WebHome')) continue
      if (!summary.fullName || (!summary.xwikiAbsoluteUrl && !summary.xwikiRelativeUrl)) {
        warnings.push(`children-invalid:${current.fullName}`)
        continue
      }
      if (seen.has(summary.fullName)) continue
      if (pages.length >= maxPages) throw new Error(`REST traversal exceeded maxPages=${maxPages}`)
      seen.add(summary.fullName)
      pages.push({
        fullName: summary.fullName,
        parent: summary.parent ?? current.fullName,
        sourceURL: canonicalSourceURL(
          summary.xwikiAbsoluteUrl ?? summary.xwikiRelativeUrl!,
          origin,
        ),
        title: summary.title?.trim() || summary.fullName,
      })
      const linkedChildren = summary.links?.find((link) => link.rel === CHILDREN_REL)?.href
      if (linkedChildren) queue.push({ fullName: summary.fullName, url: linkedChildren })
    }
  }
  return { pages, warnings }
}

export async function fetchWithRetry(url: string, options: FetchOptions = {}): Promise<Response> {
  const attempts = options.attempts ?? 3
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? 15_000
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(
      () => controller.abort(new Error(`Časový limit požadavku: ${url}`)),
      timeoutMs,
    )
    try {
      const response = await fetchAllowed(url, { ...options, fetchImpl, signal: controller.signal })
      if (response.status >= 500 && attempt < attempts) continue
      return response
    } catch (error) {
      lastError = error
      if (error instanceof ImportPolicyError) throw error
      if (attempt === attempts) throw error
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Stažení selhalo: ${url}`)
}

const ALLOWED_PATHS = {
  image: ['/xwiki/bin/download/', '/xwiki/bin/downloadrev/'],
  page: ['/xwiki/bin/view/'],
  tree: ['/xwiki/rest/wikis/pgdenik/'],
} as const
const IMAGE_MIME_TYPES = new Set(['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp'])

function inferResourceType(url: URL): NonNullable<FetchOptions['resourceType']> {
  if (ALLOWED_PATHS.image.some((prefix) => url.pathname.startsWith(prefix))) return 'image'
  if (ALLOWED_PATHS.tree.some((prefix) => url.pathname.startsWith(prefix))) return 'tree'
  return 'page'
}

function assertAllowedURL(url: URL, resourceType: NonNullable<FetchOptions['resourceType']>): void {
  const allowedPaths = ALLOWED_PATHS[resourceType]
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'www.pgdenik.cz' ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    !allowedPaths.some((prefix) => url.pathname.startsWith(prefix)) ||
    (resourceType === 'tree' && !url.pathname.endsWith('/children'))
  )
    throw new ImportPolicyError(`Importer URL not allowed: ${url.href}`)
}

function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number)
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    )
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase()
    if (normalized.startsWith('::ffff:')) return isPublicAddress(normalized.slice(7))
    return !(
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith('ff') ||
      normalized.startsWith('2001:db8:')
    )
  }
  return false
}

async function readBounded(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes)
    throw new ImportPolicyError(`Response body exceeds limit of ${maxBytes} bytes`)
  if (!response.body) return new Uint8Array()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      throw new ImportPolicyError(`Response body exceeds limit of ${maxBytes} bytes`)
    }
    chunks.push(value)
  }
  const body = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

async function fetchAllowed(
  input: string,
  options: FetchOptions & { fetchImpl: typeof fetch; signal: AbortSignal },
): Promise<Response> {
  let current = new URL(input)
  const maxRedirects = options.maxRedirects ?? 3
  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    const resourceType = options.resourceType ?? inferResourceType(current)
    assertAllowedURL(current, resourceType)
    const lookup = options.lookup ?? (async (hostname: string) => dnsLookup(hostname, { all: true }))
    const addresses = await lookup(current.hostname)
    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address)))
      throw new ImportPolicyError(`Importer host must resolve only to public addresses: ${current.hostname}`)
    const response = await options.fetchImpl(current.href, {
      headers: { 'user-agent': 'PGDenik migration importer/1.0', ...options.headers },
      redirect: 'manual',
      signal: options.signal,
    })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      if (!location) throw new ImportPolicyError(`Redirect without Location: ${current.href}`)
      if (redirect === maxRedirects) throw new ImportPolicyError(`Too many redirects: ${input}`)
      current = new URL(location, current)
      continue
    }
    if (resourceType === 'image' && response.ok) {
      const mime = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
      if (!mime || !IMAGE_MIME_TYPES.has(mime)) throw new ImportPolicyError(`Unsupported image MIME: ${mime || 'missing'}`)
    }
    const defaultLimit = resourceType === 'image' ? 10 * 1024 * 1024 : resourceType === 'tree' ? 1024 * 1024 : 2 * 1024 * 1024
    const body = await readBounded(response, options.maxBytes ?? defaultLimit)
    return new Response(body, { headers: response.headers, status: response.status, statusText: response.statusText })
  }
  throw new ImportPolicyError(`Too many redirects: ${input}`)
}

export type SourcePage = {
  sourceURL: string
  title: string
  path: string
  parentPath: string | null
  html: string
  text: string
  images: { alt: string; url: string }[]
  embeds: { kind: 'youtube' | 'xcvid'; url: string }[]
  segments: Array<
    | { kind: 'richText'; html: string; text: string }
    | { kind: 'image'; alt: string; url: string }
    | { kind: 'youtube' | 'xcvid'; url: string }
  >
}

export function resolveParentSourceID(
  page: Pick<SourcePage, 'parentPath'>,
  pages: Array<Pick<SourcePage, 'path'> & { sourceID: string }>,
): string | null {
  if (page.parentPath === null) return null
  const matches = pages.filter((candidate) => candidate.path === page.parentPath)
  if (matches.length !== 1) throw new Error(`invalid-import-parent-path:${page.parentPath}`)
  return matches[0].sourceID
}

type LexicalNode = Record<string, unknown> & { children?: LexicalNode[] }
export type LexicalBody = { root: LexicalNode & { children: LexicalNode[] } }
type CheerioNode = ReturnType<cheerio.CheerioAPI> extends cheerio.Cheerio<infer Node> ? Node : never

const textNode = (text: string, format = 0): LexicalNode => ({
  type: 'text',
  detail: 0,
  format,
  mode: 'normal',
  style: '',
  text,
  version: 1,
})
const elementNode = (
  type: string,
  children: LexicalNode[],
  extra: Record<string, unknown> = {},
): LexicalNode => ({ type, children, direction: null, format: '', indent: 0, version: 1, ...extra })

function inlineNodes($: cheerio.CheerioAPI, element: CheerioNode, format = 0): LexicalNode[] {
  const nodes: LexicalNode[] = []
  for (const child of $(element).contents().toArray()) {
    if (child.type === 'text') {
      if (child.data) nodes.push(textNode(child.data, format))
      continue
    }
    if (child.type !== 'tag') continue
    const tag = child.tagName.toLowerCase()
    const nextFormat =
      format | (tag === 'strong' || tag === 'b' ? 1 : 0) | (tag === 'em' || tag === 'i' ? 2 : 0)
    if (tag === 'br') {
      nodes.push({ type: 'linebreak', version: 1 })
      continue
    }
    const children = inlineNodes($, child, nextFormat)
    if (tag === 'a') {
      const rawURL = $(child).attr('href')
      const url = rawURL
      if (children.length && url && /^(https?:\/\/|mailto:|\/|#)/.test(url))
        nodes.push(
          elementNode('link', children, {
            fields: { linkType: 'custom', newTab: false, url },
            version: 3,
          }),
        )
      else nodes.push(...children)
    } else nodes.push(...children)
  }
  return nodes
}

export function sourcePageToLexical(page: SourcePage): LexicalBody {
  const $ = cheerio.load(`<div id="import-root">${page.html}</div>`)
  const root = $('#import-root')
  root.find('img,iframe,object,embed,applet,script,style,form').remove()
  const children: LexicalNode[] = []
  const appendBlock = (element: CheerioNode, target: LexicalNode[]) => {
    if (element.type !== 'tag') return
    const tag = element.tagName.toLowerCase()
    if (/^h[1-6]$/.test(tag))
      target.push(elementNode('heading', inlineNodes($, element), { anchor: $(element).attr('id'), tag: tag === 'h1' ? 'h2' : tag }))
    else if (tag === 'ul' || tag === 'ol') {
      const items = $(element)
        .children('li')
        .toArray()
        .map((item, index) => {
          const itemChildren = inlineNodes($, item)
          for (const nested of $(item).children('ul,ol').toArray()) appendBlock(nested, itemChildren)
          return elementNode('listitem', itemChildren, { value: index + 1 })
        })
      target.push(
        elementNode('list', items, { listType: tag === 'ol' ? 'number' : 'bullet', start: 1, tag }),
      )
    } else if (['div', 'section', 'article', 'main', 'header', 'footer', 'aside'].includes(tag)) {
      for (const child of $(element).children().toArray()) appendBlock(child, target)
    } else {
      const inline = inlineNodes($, element)
      const visible = $(element).text().trim()
      if (inline.length || visible)
        target.push(
          elementNode('paragraph', inline.length ? inline : [textNode(visible)], {
            textFormat: 0,
            textStyle: '',
          }),
        )
    }
  }
  for (const element of root.children().toArray()) {
    appendBlock(element, children)
  }
  if (!children.length)
    children.push(
      elementNode('paragraph', [textNode(page.text || page.title)], {
        textFormat: 0,
        textStyle: '',
      }),
    )
  return { root: elementNode('root', children) as LexicalBody['root'] }
}

export function sourceURLToPath(input: string): string | null {
  const url = new URL(input, SOURCE_ORIGIN)
  if (url.origin !== SOURCE_ORIGIN || !url.pathname.startsWith(VIEW_PREFIX)) return null
  const sourcePath = decodeURIComponent(url.pathname.slice(VIEW_PREFIX.length))
    .replace(/\/WebHome\/?$/, '')
    .replace(/\/$/, '')
  if (!sourcePath || sourcePath === 'Main') return '/'
  return normalizePublicPath(`/${sourcePath}`)
}

export function parseSourcePage(
  html: string,
  sourceURL: string,
): { page: SourcePage; problems: { sourceURL: string; reason: string }[] } {
  const $ = cheerio.load(html)
  const content = $('#xwikicontent').first()
  if (!content.length) throw new Error(`Chybí veřejný obsah: ${sourceURL}`)
  const canonical = $('link[rel="canonical"]').attr('href') || sourceURL
  const path = sourceURLToPath(canonical) ?? sourceURLToPath(sourceURL)
  if (!path) throw new Error(`Neplatná veřejná URL: ${sourceURL}`)
  const segments = path.split('/').filter(Boolean)
  const parentPath =
    segments.length > 1 ? `/${segments.slice(0, -1).join('/')}` : segments.length === 1 ? '/' : null
  const problems: { sourceURL: string; reason: string }[] = []

  content.find('script,style,form').remove()
  content.find('object,embed,applet,video,audio,canvas,svg').each((_, element) => {
    problems.push({ sourceURL, reason: `unsupported-element:${element.tagName}` })
    $(element).replaceWith($(element).contents())
  })
  content.find('table').each((_, element) => {
    problems.push({ sourceURL, reason: `unsupported-element:${element.tagName}` })
  })
  content.find('a[href]').each((_, element) => {
    const href = $(element).attr('href')!
    if (href.startsWith('#') && href.length > 1 && !/\s/.test(href)) return
    const target = sourceURLToPath(href)
    if (target) {
      $(element).attr('href', target)
      return
    }
    try {
      const external = new URL(href, SOURCE_ORIGIN)
      if (/\s/.test(href) || !['http:', 'https:', 'mailto:'].includes(external.protocol))
        throw new Error('unsupported')
    } catch {
      problems.push({ sourceURL, reason: `invalid-link:${href}` })
      $(element).replaceWith($(element).contents())
    }
  })
  const images: SourcePage['images'] = []
  const embeds: SourcePage['embeds'] = []
  content.find('iframe[src]').each((_, element) => {
    const src = $(element).attr('src')!
    try {
      const url = new URL(src, SOURCE_ORIGIN)
      const kind = ['youtube.com', 'www.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)
        ? 'youtube'
        : ['xcvid.com', 'www.xcvid.com'].includes(url.hostname)
          ? 'xcvid'
          : null
      if (!kind) problems.push({ sourceURL, reason: `unsupported-iframe:${url.href}` })
      else embeds.push({ kind, url: validateEmbedURL(kind, url.href) })
    } catch {
      problems.push({ sourceURL, reason: `invalid-iframe:${src}` })
    }
  })
  const contentSegments: SourcePage['segments'] = []
  let richNodes: CheerioNode[] = []
  const flushRichText = () => {
    const html = richNodes.map((node) => $.html(node)).join('')
    const text = cheerio.load(`<div>${html}</div>`)('div').text().replace(/\s+/g, ' ').trim()
    if (text || /<(?:h[1-6]|ul|ol|p|a)\b/i.test(html)) contentSegments.push({ kind: 'richText', html, text })
    richNodes = []
  }
  const walkOrdered = (nodes: CheerioNode[]) => {
    for (const node of nodes) {
      if (node.type !== 'tag') {
        if (node.type === 'text' && node.data.trim()) richNodes.push(node)
        continue
      }
      const tag = node.tagName.toLowerCase()
      if (tag === 'img') {
        flushRichText()
        const raw = $(node).attr('src')
        if (!raw) continue
        try {
          const url = new URL(raw, SOURCE_ORIGIN)
          assertAllowedURL(url, 'image')
          const image = { alt: ($(node).attr('alt') || '').trim(), url: url.href }
          images.push(image)
          contentSegments.push({ kind: 'image', ...image })
          if (!image.alt) problems.push({ sourceURL, reason: `missing-image-alt:${image.url}` })
        } catch {
          problems.push({ sourceURL, reason: `invalid-image:${raw}` })
        }
      } else if (tag === 'iframe') {
        flushRichText()
        const raw = $(node).attr('src')
        const embed = raw ? embeds.find((candidate) => {
          try { return candidate.url === validateEmbedURL(candidate.kind, new URL(raw, SOURCE_ORIGIN).href) } catch { return false }
        }) : undefined
        if (embed) contentSegments.push(embed)
      } else if ($(node).find('img,iframe').length) {
        walkOrdered($(node).contents().toArray())
      } else richNodes.push(node)
    }
  }
  walkOrdered(content.contents().toArray())
  flushRichText()
  return {
    page: {
      sourceURL,
      title:
        $('#document-title h1').first().text().trim() || $('title').text().split(' - ')[0].trim(),
      path,
      parentPath,
      html: content.html() || '',
      text: content.text().replace(/\s+/g, ' ').trim(),
      images,
      embeds,
      segments: contentSegments,
    },
    problems,
  }
}
