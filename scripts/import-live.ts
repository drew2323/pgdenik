import 'dotenv/config'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import {
  discoverPublicTree,
  fetchWithRetry,
  parseSourcePage,
  sourcePageToLexical,
  type PublicTreePage,
  type SourcePage,
} from '../src/importer/parser'
import {
  assertAuthoritativeTree,
  importPages,
  type ImportPayload,
  type PreparedImportPage,
} from '../src/importer/runner'

const origin = 'https://www.pgdenik.cz'
const output = path.resolve('artifacts/import')
const MAX_IMAGES = 500
const MAX_TOTAL_IMAGE_BYTES = 250 * 1024 * 1024
type Status = 'imported' | 'skipped' | 'problem'
type Entry = { sourceID: string; sourceURL: string; status: Status; reason: string }
type AuditedPage = SourcePage & { sourceID: string; sourceParent: string }
type ImportImageBlock = { blockType: 'importImage'; alt: string; sourceURL: string }

const errorReason = (error: unknown) => {
  if (!(error instanceof Error)) return 'unknown-error'
  const details = (error as Error & { data?: { errors?: unknown } }).data?.errors
  return details ? `${error.message}: ${JSON.stringify(details)}` : error.message
}

async function fetchPublicPages(tree: PublicTreePage[]) {
  const pages: AuditedPage[] = []
  const skipped: Entry[] = []
  const problems: Entry[] = []
  for (const node of tree) {
    try {
      const response = await fetchWithRetry(node.sourceURL, { resourceType: 'page' })
      if (!response.ok) throw new Error(`http-${response.status}`)
      const parsed = parseSourcePage(await response.text(), node.sourceURL)
      pages.push({ ...parsed.page, sourceID: node.fullName, sourceParent: node.parent })
      for (const issue of parsed.problems)
        problems.push({
          sourceID: node.fullName,
          sourceURL: node.sourceURL,
          status: 'problem',
          reason: issue.reason,
        })
    } catch (error) {
      skipped.push({ sourceID: node.fullName, sourceURL: node.sourceURL, status: 'skipped', reason: errorReason(error) })
    }
  }
  return { pages, problems, skipped }
}

function preparePages(pages: AuditedPage[]): PreparedImportPage[] {
  return pages.map((page) => ({
    sourceID: page.sourceID,
    sourceParent: page.sourceParent,
    sourceURL: page.sourceURL,
    title: page.title,
    path: page.path,
    parentPath: page.parentPath,
    blocks: page.segments.length
      ? page.segments.map((segment) => {
          if (segment.kind === 'richText')
            return {
              blockType: 'richText',
              body: sourcePageToLexical({ ...page, html: segment.html, text: segment.text }),
            }
          if (segment.kind === 'image')
            return { blockType: 'importImage', alt: segment.alt, sourceURL: segment.url }
          return { blockType: segment.kind, url: segment.url }
        })
      : [
          // A page whose only content was unsupported (e.g. a <video>) must
          // still create a valid page with a single paragraph instead of an
          // empty content array that Payload validation rejects.
          {
            blockType: 'richText',
            body: sourcePageToLexical({ ...page, html: '', text: page.text || page.title }),
          },
        ],
  }))
}

async function downloadImages(pages: PreparedImportPage[], directory: string) {
  const images = new Map<string, { alt: string; filePath: string }>()
  const requested = pages.flatMap((page) =>
    page.blocks.filter((block): block is ImportImageBlock => block.blockType === 'importImage'),
  )
  if (requested.length > MAX_IMAGES) throw new Error(`Image count exceeds limit of ${MAX_IMAGES}`)
  let totalBytes = 0
  for (const image of requested) {
    if (!image.alt) throw new Error(`Image is missing required alt text: ${image.sourceURL}`)
    if (images.has(image.sourceURL)) continue
    const response = await fetchWithRetry(image.sourceURL, { resourceType: 'image' })
    if (!response.ok) throw new Error(`Image HTTP ${response.status}: ${image.sourceURL}`)
    const mime = response.headers.get('content-type')?.split(';', 1)[0]
    const extension = mime === 'image/png' ? '.png' : mime === 'image/gif' ? '.gif' : mime === 'image/webp' ? '.webp' : mime === 'image/avif' ? '.avif' : '.jpg'
    const bytes = Buffer.from(await response.arrayBuffer())
    totalBytes += bytes.byteLength
    if (totalBytes > MAX_TOTAL_IMAGE_BYTES)
      throw new Error(`Total image bytes exceed limit of ${MAX_TOTAL_IMAGE_BYTES}`)
    const filePath = path.join(directory, `${images.size.toString().padStart(4, '0')}${extension}`)
    await writeFile(filePath, bytes)
    images.set(image.sourceURL, { alt: image.alt, filePath })
  }
  return images
}

async function writeReport(args: {
  entries: Entry[]
  pages: AuditedPage[]
  reconciliation: Record<string, unknown>
  tree: PublicTreePage[]
}) {
  const all = args.entries.sort(
    (a, b) => a.sourceID.localeCompare(b.sourceID) || a.status.localeCompare(b.status) || a.reason.localeCompare(b.reason),
  )
  const counts = {
    discovered: args.tree.length,
    imported: all.filter((entry) => entry.status === 'imported').length,
    skipped: all.filter((entry) => entry.status === 'skipped').length,
    problem: all.filter((entry) => entry.status === 'problem').length,
  }
  await mkdir(output, { recursive: true })
  await writeFile(path.join(output, 'public-tree.json'), `${JSON.stringify({ method: 'public XWiki REST children traversal', source: origin, pages_count: args.tree.length, pages: args.tree }, null, 2)}\n`)
  await writeFile(path.join(output, 'source-pages.json'), `${JSON.stringify(args.pages, null, 2)}\n`)
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), source: origin, counts, reconciliation: args.reconciliation, entries: all }, null, 2)}\n`)
  await writeFile(
    path.join(output, 'report.md'),
    `# Import PG Deník\n\nSource: ${origin}\nDiscovery: public XWiki REST children traversal\n\n- Discovered: ${counts.discovered}\n- Imported: ${counts.imported}\n- Skipped: ${counts.skipped}\n- Problems: ${counts.problem}\n\n| Status | Source ID | Source | Reason |\n|---|---|---|---|\n${all.map((entry) => `| ${entry.status} | ${entry.sourceID.replaceAll('|', '\\|')} | ${entry.sourceURL.replaceAll('|', '%7C')} | ${entry.reason.replaceAll('|', '\\|')} |`).join('\n')}\n`,
  )
  console.log(JSON.stringify({ counts, reconciliation: args.reconciliation }))
}

async function run() {
  const entries: Entry[] = []
  let pages: AuditedPage[] = []
  let tree: PublicTreePage[] = []
  const reconciliation: Record<string, unknown> = {}
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'pgdenik-import-'))
  try {
    const traversal = await discoverPublicTree({ maxPages: 250, origin })
    tree = traversal.pages
    const treeIDs = tree.map((page) => page.fullName)
    Object.assign(reconciliation, { authoritativeSourceIDs: 67, discoveredSourceIDs: treeIDs.length, traversalWarnings: traversal.warnings })
    assertAuthoritativeTree(treeIDs)
    if (traversal.warnings.length) throw new Error(`Traversal warnings: ${traversal.warnings.join('; ')}`)

    const fetched = await fetchPublicPages(tree)
    pages = fetched.pages
    entries.push(...fetched.skipped, ...fetched.problems)
    const fetchedIDs = pages.map((page) => page.sourceID)
    Object.assign(reconciliation, { fetchedSourceIDs: fetchedIDs.length, missingFetchedIDs: treeIDs.filter((id) => !fetchedIDs.includes(id)) })
    assertAuthoritativeTree(fetchedIDs)
    if (fetched.skipped.length)
      throw new Error(`Skipped source pages: ${fetched.skipped.map((entry) => entry.sourceID).join(', ')}`)

    const prepared = preparePages(pages)
    const images = await downloadImages(prepared, temporaryDirectory)
    const payload = await getPayload({ config })
    const imported = await importPages({
      pages: prepared,
      payload: payload as unknown as ImportPayload,
      resolveBlocks: async (page, req) => {
        const blocks: Array<Record<string, unknown> & { blockType: string }> = []
        for (const block of page.blocks) {
          if (block.blockType !== 'importImage') {
            blocks.push(block)
            continue
          }
          const image = block as ImportImageBlock
          const downloaded = images.get(image.sourceURL)
          if (!downloaded) throw new Error(`Missing preflight image: ${image.sourceURL}`)
          let media = (await payload.find({ collection: 'media', depth: 0, limit: 1, req, where: { sourceURL: { equals: image.sourceURL } } })).docs[0]
          if (!media)
            media = await payload.create({ collection: 'media', data: { alt: image.alt, sourceURL: image.sourceURL }, depth: 0, filePath: downloaded.filePath, req })
          else if (media.alt !== image.alt)
            media = await payload.update({ collection: 'media', data: { alt: image.alt }, depth: 0, id: media.id, req })
          blocks.push({ blockType: 'image', image: media.id })
        }
        return blocks
      },
    })
    entries.push(...imported)
    Object.assign(reconciliation, { destinationSourceIDs: imported.length })
  } catch (error) {
    entries.push({ sourceID: 'IMPORT', sourceURL: origin, status: 'problem', reason: errorReason(error) })
    throw error
  } finally {
    await writeReport({ entries, pages, reconciliation, tree })
    await rm(temporaryDirectory, { force: true, recursive: true })
  }
}

run().catch((error) => {
  console.error(errorReason(error))
  process.exitCode = 1
})
