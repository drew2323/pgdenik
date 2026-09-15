import { describe, expect, it } from 'vitest'
import {
  discoverPublicTree,
  fetchWithRetry,
  parseSourcePage,
  resolveParentSourceID,
  sourcePageToLexical,
} from '@/importer/parser'

const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }]

const source = `<!doctype html><html><head><link rel="canonical" href="/xwiki/bin/view/Tipy/Test/" /></head><body>
  <div id="document-title"><h1>Testovací let</h1></div>
  <div id="xwikicontent"><p>Text <a href="/xwiki/bin/view/Tipy/Dalsi/">dále</a>.</p>
  <img src="/xwiki/bin/download/Tipy/Test/foto.jpg" alt="Křídlo nad kopcem"><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe><iframe src="https://xcvid.com/embed.php?ident=david/1.2.2021/10:30"></iframe>
  <a href="https://xcvid.com/2217489#355">Let v XCvid</a><object data="legacy.swf"></object></div>
</body></html>`

describe('live importer parser', () => {
  it('uses the URL hierarchy when REST sourceParent points at a sibling page', () => {
    const pages = [
      { sourceID: 'Main.WebHome', path: '/', parentPath: null },
      { sourceID: 'Analyzy letu.WebHome', path: '/analyzy-letu', parentPath: '/' },
      {
        sourceID: 'Analyzy letu.26\\.4\\.2021-certak.WebHome',
        path: '/analyzy-letu/26-4-2021-certak',
        parentPath: '/analyzy-letu',
      },
      {
        sourceID: 'Analyzy letu.31\\.5\\.2021-certak.WebHome',
        sourceParent: 'Analyzy letu.26\\.4\\.2021-certak.WebHome',
        path: '/analyzy-letu/31-5-2021-certak',
        parentPath: '/analyzy-letu',
      },
    ]

    expect(resolveParentSourceID(pages[3], pages)).toBe('Analyzy letu.WebHome')
  })

  it('discovers the complete hierarchy through bounded REST children traversal and reconciles every source ID', async () => {
    const children = new Map<
      string,
      Array<{
        fullName: string
        title: string
        parent: string
        xwikiAbsoluteUrl: string
        links?: Array<{ href: string; rel: string }>
      }>
    >([
      [
        'Main.WebHome',
        [
          {
            fullName: 'Visible.WebHome',
            title: 'Visible',
            parent: 'Main.WebHome',
            xwikiAbsoluteUrl: 'https://www.pgdenik.cz:443/xwiki/bin/view/Visible/',
            links: [
              {
                href: 'https://www.pgdenik.cz/xwiki/rest/wikis/pgdenik/spaces/Visible/pages/WebHome/children',
                rel: 'http://www.xwiki.org/rel/children',
              },
            ],
          },
          {
            fullName: 'Orphaned.WebHome',
            title: 'Not linked from HTML',
            parent: 'Main.WebHome',
            xwikiAbsoluteUrl: 'https://www.pgdenik.cz:443/xwiki/bin/view/Orphaned/',
          },
        ],
      ],
      [
        'Visible.WebHome',
        [
          {
            fullName: 'Visible.Deep.WebHome',
            title: 'Deep child',
            parent: 'Visible.WebHome',
            xwikiAbsoluteUrl: 'https://www.pgdenik.cz:443/xwiki/bin/view/Visible/Deep/',
          },
        ],
      ],
      ['Orphaned.WebHome', []],
      ['Visible.Deep.WebHome', []],
    ])
    const requests: string[] = []
    const fetchImpl = async (input: string | URL | Request) => {
      const url = String(input)
      requests.push(url)
      const decoded = decodeURIComponent(url)
      const id = [...children.keys()].find((candidate) => {
        const [space, page] = candidate.split(/\.(?=[^.]+$)/)
        return decoded.includes(
          `/spaces/${space.replaceAll('.', '/spaces/')}/pages/${page}/children`,
        )
      })
      return new Response(JSON.stringify({ pageSummaries: id ? children.get(id) : [] }), {
        headers: { 'content-type': 'application/json' },
        status: id ? 200 : 404,
      })
    }

    const result = await discoverPublicTree({
      fetchImpl,
      lookup: publicLookup,
      maxPages: 4,
      origin: 'https://www.pgdenik.cz',
      rootSourceIDs: ['Visible.WebHome', 'Orphaned.WebHome'],
    })

    expect(result.pages.map((page) => page.fullName)).toEqual([
      'Main.WebHome',
      'Visible.WebHome',
      'Orphaned.WebHome',
      'Visible.Deep.WebHome',
    ])
    expect(new Set(result.pages.map((page) => page.sourceURL)).size).toBe(4)
    expect(result.warnings).toEqual([])
    expect(requests).toHaveLength(2)
  })

  it('preserves path hierarchy, internal links, image and supported embeds', () => {
    const result = parseSourcePage(source, 'https://www.pgdenik.cz/xwiki/bin/view/Tipy/Test/')
    expect(result.page.title).toBe('Testovací let')
    expect(result.page.path).toBe('/tipy/test')
    expect(result.page.parentPath).toBe('/tipy')
    expect(result.page.html).toContain('href="/tipy/dalsi"')
    expect(result.page.images).toEqual([
      {
        alt: 'Křídlo nad kopcem',
        url: 'https://www.pgdenik.cz/xwiki/bin/download/Tipy/Test/foto.jpg',
      },
    ])
    expect(result.page.embeds).toEqual(
      expect.arrayContaining([
        { kind: 'youtube', url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' },
        {
          kind: 'xcvid',
          url: 'https://xcvid.com/embed.php?ident=david%2F1.2.2021%2F10%3A30',
        },
      ]),
    )
  })

  it('reports unsupported content instead of silently dropping it', () => {
    const result = parseSourcePage(source, 'https://www.pgdenik.cz/xwiki/bin/view/Tipy/Test/')
    expect(result.problems).toEqual([
      {
        reason: 'unsupported-element:object',
        sourceURL: 'https://www.pgdenik.cz/xwiki/bin/view/Tipy/Test/',
      },
    ])
  })

  it('keeps headings, paragraphs, lists and internal links as editable rich text', () => {
    const parsed = parseSourcePage(
      `<!doctype html><html><head></head><body>
      <div id="document-title"><h1>Struktura</h1></div>
      <div id="xwikicontent"><h2>Nadpis</h2><p>Úvod <strong>tučně</strong> a <a href="/xwiki/bin/view/Tipy/Dalsi/">odkaz</a>.</p><ul><li>První</li><li>Druhý</li></ul></div>
    </body></html>`,
      'https://www.pgdenik.cz/xwiki/bin/view/Tipy/Struktura/',
    )
    const body = sourcePageToLexical(parsed.page)
    expect(body.root.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'heading', tag: 'h2' }),
        expect.objectContaining({ type: 'paragraph' }),
        expect.objectContaining({ type: 'list', listType: 'bullet' }),
      ]),
    )
    expect(JSON.stringify(body)).toContain('"url":"/tipy/dalsi"')
    expect(JSON.stringify(body)).toContain('tučně')
  })

  it('recursively preserves nested headings and lists, including nested list items', () => {
    const parsed = parseSourcePage(
      `<!doctype html><html><body><div id="document-title"><h1>Nested</h1></div>
      <div id="xwikicontent"><section><div><h2 id="wind">Vítr</h2><ol><li>První<ul><li>Vnořená</li></ul></li></ol></div></section></div></body></html>`,
      'https://www.pgdenik.cz/xwiki/bin/view/Tipy/Nested/',
    )
    const serialized = JSON.stringify(sourcePageToLexical(parsed.page))

    expect(serialized).toContain('"type":"heading"')
    expect(serialized).toContain('"anchor":"wind"')
    expect(serialized).toContain('"listType":"number"')
    expect(serialized).toContain('"listType":"bullet"')
    expect(serialized).toContain('Vnořená')
  })

  it('preserves same-page fragment links and their targets', () => {
    const parsed = parseSourcePage(
      `<!doctype html><html><body><div id="document-title"><h1>Anchors</h1></div>
      <div id="xwikicontent"><p><a href="#pristani">Přistání</a></p><h2 id="pristani">Přistání</h2></div></body></html>`,
      'https://www.pgdenik.cz/xwiki/bin/view/Tipy/Anchors/',
    )
    const serialized = JSON.stringify(sourcePageToLexical(parsed.page))

    expect(serialized).toContain('"url":"#pristani"')
    expect(serialized).toContain('"anchor":"pristani"')
    expect(parsed.problems).toEqual([])
  })

  it('preserves source ordering across text, image, YouTube and XCvid blocks', () => {
    const parsed = parseSourcePage(
      `<!doctype html><html><body><div id="document-title"><h1>Order</h1></div>
      <div id="xwikicontent"><p>Before</p><img src="/xwiki/bin/download/Order/a.jpg" alt="A"><p>Middle</p><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe><p>After</p><iframe src="https://xcvid.com/embed.php?ident=test/1"></iframe></div></body></html>`,
      'https://www.pgdenik.cz/xwiki/bin/view/Order/',
    )

    expect(parsed.page.segments.map((segment) => segment.kind)).toEqual([
      'richText',
      'image',
      'richText',
      'youtube',
      'richText',
      'xcvid',
    ])
    expect(parsed.page.segments[3]).toEqual({
      kind: 'youtube',
      url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    })
  })

  it('retains supported external links and reports every unsupported visible element', () => {
    const parsed = parseSourcePage(
      `<!doctype html><html><body><div id="document-title"><h1>Legacy</h1></div><div id="xwikicontent">
      <p><a href="http://example.com/help">HTTP</a> <a href="mailto:pilot@example.com">Mail</a></p>
      <video>Video label</video><audio>Audio label</audio><canvas>Canvas label</canvas><svg><text>SVG label</text></svg>
      </div></body></html>`,
      'https://www.pgdenik.cz/xwiki/bin/view/Legacy/',
    )
    const serialized = JSON.stringify(sourcePageToLexical(parsed.page))

    expect(serialized).toContain('http://example.com/help')
    expect(serialized).toContain('mailto:pilot@example.com')
    expect(parsed.problems.map((problem) => problem.reason)).toEqual([
      'unsupported-element:video',
      'unsupported-element:audio',
      'unsupported-element:canvas',
      'unsupported-element:svg',
    ])
    expect(parsed.page.text).toContain('Video label')
  })

  it('keeps the page title as the only level-one heading', () => {
    const parsed = parseSourcePage(
      `<!doctype html><html><body><div id="document-title"><h1>Let</h1></div><div id="xwikicontent"><h1>Předpověď</h1><h2>Detail</h2></div></body></html>`,
      'https://www.pgdenik.cz/xwiki/bin/view/Analyzy/Let/',
    )

    expect(sourcePageToLexical(parsed.page).root.children).toEqual([
      expect.objectContaining({ type: 'heading', tag: 'h2' }),
      expect.objectContaining({ type: 'heading', tag: 'h2' }),
    ])
  })

  it('reports unsupported visible elements while retaining their text', () => {
    const parsed = parseSourcePage(
      `<!doctype html><html><body><div id="document-title"><h1>Legacy</h1></div><div id="xwikicontent"><table><tr><td>Důležitá hodnota</td></tr></table></div></body></html>`,
      'https://www.pgdenik.cz/xwiki/bin/view/Legacy/',
    )
    expect(parsed.problems).toContainEqual(
      expect.objectContaining({ reason: 'unsupported-element:table' }),
    )
    expect(parsed.page.text).toContain('Důležitá hodnota')
  })

  it('does not create invalid empty links for linked managed images', () => {
    const parsed = parseSourcePage(
      `<!doctype html><html><body><div id="document-title"><h1>Obrázek</h1></div><div id="xwikicontent"><p><a href="/xwiki/bin/download/Test/foto.jpg"><img src="/xwiki/bin/download/Test/foto.jpg" alt="Let"></a></p></div></body></html>`,
      'https://www.pgdenik.cz/xwiki/bin/view/Test/',
    )
    const body = sourcePageToLexical(parsed.page)
    expect(JSON.stringify(body)).not.toContain('"type":"link","children":[]')
  })

  it('reports malformed links and keeps their visible label as text', () => {
    const parsed = parseSourcePage(
      `<!doctype html><html><body><div id="document-title"><h1>Odkaz</h1></div><div id="xwikicontent"><p><a href="https://example.com/video title accidentally appended">Důležitý popis</a></p></div></body></html>`,
      'https://www.pgdenik.cz/xwiki/bin/view/Odkaz/',
    )
    expect(parsed.problems).toContainEqual(
      expect.objectContaining({ reason: expect.stringMatching(/^invalid-link:/) }),
    )
    expect(parsed.page.text).toContain('Důležitý popis')
    expect(JSON.stringify(sourcePageToLexical(parsed.page))).not.toContain('"type":"link"')
  })

  it('bounds stalled requests and retries transient failures', async () => {
    let attempts = 0
    const transientFetch = async () => {
      attempts += 1
      if (attempts === 1) return new Response('', { status: 503 })
      return new Response('ok', { status: 200 })
    }
    const response = await fetchWithRetry('https://www.pgdenik.cz/xwiki/bin/view/Test/', {
      attempts: 2,
      fetchImpl: transientFetch,
      lookup: publicLookup,
      timeoutMs: 50,
    })
    expect(await response.text()).toBe('ok')
    expect(attempts).toBe(2)

    const hangingFetch = (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      })
    await expect(
      fetchWithRetry('https://www.pgdenik.cz/xwiki/bin/view/Stall/', {
        attempts: 1,
        fetchImpl: hangingFetch,
        lookup: publicLookup,
        timeoutMs: 5,
      }),
    ).rejects.toThrow(/časový limit/i)
  })

  it.each([
    'http://www.pgdenik.cz/xwiki/bin/view/Test/',
    'https://evil.test/xwiki/bin/view/Test/',
    'https://www.pgdenik.cz/admin',
    'https://user:pass@www.pgdenik.cz/xwiki/bin/view/Test/',
  ])('rejects non-allowlisted importer URL %s before fetching', async (url) => {
    const fetchImpl = async () => new Response('must not run')
    await expect(fetchWithRetry(url, { fetchImpl, lookup: publicLookup })).rejects.toThrow(
      /not allowed/i,
    )
  })

  it.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', 'fc00::1', 'fe80::1'])(
    'rejects private or special resolved address %s',
    async (address) => {
      const fetchImpl = async () => new Response('must not run')
      await expect(
        fetchWithRetry('https://www.pgdenik.cz/xwiki/bin/view/Test/', {
          fetchImpl,
          lookup: async () => [{ address, family: address.includes(':') ? 6 : 4 }],
        }),
      ).rejects.toThrow(/public address/i)
    },
  )

  it('validates every redirect hop and refuses redirects off the allowlist', async () => {
    const requests: string[] = []
    const fetchImpl = async (input: string | URL | Request) => {
      requests.push(String(input))
      return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } })
    }

    await expect(
      fetchWithRetry('https://www.pgdenik.cz/xwiki/bin/view/Test/', {
        fetchImpl,
        lookup: publicLookup,
      }),
    ).rejects.toThrow(/not allowed/i)
    expect(requests).toHaveLength(1)
  })

  it('enforces bounded page and image bodies plus image MIME allowlists', async () => {
    const tooLargePage = async () =>
      new Response('x'.repeat(65), { headers: { 'content-type': 'text/html' } })
    await expect(
      fetchWithRetry('https://www.pgdenik.cz/xwiki/bin/view/Test/', {
        fetchImpl: tooLargePage,
        lookup: publicLookup,
        maxBytes: 64,
      }),
    ).rejects.toThrow(/body.*limit/i)

    const wrongMime = async () =>
      new Response('<script>bad</script>', { headers: { 'content-type': 'text/html' } })
    await expect(
      fetchWithRetry('https://www.pgdenik.cz/xwiki/bin/download/Test/a.jpg', {
        fetchImpl: wrongMime,
        lookup: publicLookup,
        resourceType: 'image',
      }),
    ).rejects.toThrow(/image MIME/i)
  })
})
