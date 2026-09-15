import treeBaseline from '../../artifacts/import/public-tree.json'

export const AUTHORITATIVE_SOURCE_IDS = treeBaseline.pages.map((page) => page.fullName)

export type PreparedImportPage = {
  sourceID: string
  sourceParent: string
  sourceURL: string
  title: string
  path: string
  parentPath: string | null
  blocks: Array<Record<string, unknown> & { blockType: string }>
}

type ImportDocument = Record<string, unknown> & { id: number | string }
type FindArgs = {
  collection: string
  depth?: number
  limit?: number
  pagination?: boolean
  req?: Record<string, unknown>
  where?: Record<string, unknown>
}

export type ImportPayload = {
  db: {
    beginTransaction: () => Promise<null | number | string>
    commitTransaction: (id: number | string) => Promise<unknown>
    rollbackTransaction: (id: number | string) => Promise<unknown>
  }
  find: (args: FindArgs) => Promise<{ docs: ImportDocument[] }>
  create: (args: Record<string, unknown>) => Promise<ImportDocument>
  update: (args: Record<string, unknown>) => Promise<ImportDocument>
}

export type ImportResult = {
  sourceID: string
  sourceURL: string
  status: 'imported'
  reason: 'created' | 'updated' | 'unchanged'
}

export function assertAuthoritativeTree(
  actual: string[],
  expected: string[] = AUTHORITATIVE_SOURCE_IDS,
): void {
  const actualSet = new Set(actual)
  const expectedSet = new Set(expected)
  if (
    actual.length !== expected.length ||
    actualSet.size !== actual.length ||
    expected.some((id) => !actualSet.has(id)) ||
    actual.some((id) => !expectedSet.has(id))
  ) {
    const missing = expected.filter((id) => !actualSet.has(id))
    const unexpected = actual.filter((id) => !expectedSet.has(id))
    throw new Error(
      `Authoritative source-ID mismatch: expected ${expected.length} (production baseline 67), got ${actual.length}; missing=${JSON.stringify(missing)} unexpected=${JSON.stringify(unexpected)}`,
    )
  }
}

function relationshipID(value: unknown): unknown {
  return value && typeof value === 'object' && 'id' in value
    ? (value as { id: unknown }).id
    : value ?? null
}

function normalizedBlocks(value: unknown): unknown[] {
  if (!Array.isArray(value)) return []
  return value.map((raw) => {
    const block = raw as Record<string, unknown>
    const result: Record<string, unknown> = { blockType: block.blockType }
    if (block.blockType === 'richText') result.body = block.body
    if (block.blockType === 'image') {
      result.image = relationshipID(block.image)
      result.caption = block.caption ?? null
    }
    if (block.blockType === 'youtube' || block.blockType === 'xcvid') result.url = block.url
    return result
  })
}

function comparablePage(doc: Record<string, unknown>) {
  return {
    _status: doc._status,
    content: normalizedBlocks(doc.content),
    menuTitle: doc.menuTitle ?? null,
    order: Number(doc.order),
    parent: relationshipID(doc.parent),
    path: doc.path,
    showInMenu: doc.showInMenu,
    sourceURL: doc.sourceURL,
    title: doc.title,
  }
}

function samePage(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return JSON.stringify(comparablePage(left)) === JSON.stringify(comparablePage(right))
}

export async function importPages({
  expectedSourceIDs = AUTHORITATIVE_SOURCE_IDS,
  pages,
  payload,
  resolveBlocks,
}: {
  expectedSourceIDs?: string[]
  pages: PreparedImportPage[]
  payload: ImportPayload
  resolveBlocks?: (
    page: PreparedImportPage,
    req: Record<string, unknown>,
  ) => Promise<PreparedImportPage['blocks']>
}): Promise<ImportResult[]> {
  assertAuthoritativeTree(
    pages.map((page) => page.sourceID),
    expectedSourceIDs,
  )
  const sourceURLs = new Set(pages.map((page) => page.sourceURL))
  if (sourceURLs.size !== pages.length) throw new Error('Duplicate source URLs in import input')

  const before = await payload.find({ collection: 'pages', depth: 0, limit: 1000, pagination: false })
  const imported = before.docs.filter(
    (doc) => typeof doc.sourceURL === 'string' && doc.sourceURL.startsWith('https://www.pgdenik.cz/'),
  )
  const stale = imported.filter((doc) => !sourceURLs.has(String(doc.sourceURL)))
  if (stale.length)
    throw new Error(`Stale imported records require an explicit deletion manifest: ${stale.map((doc) => doc.sourceURL).join(', ')}`)

  const existingByURL = new Map(imported.map((doc) => [String(doc.sourceURL), doc]))
  const sourceIDByURL = new Map(pages.map((page) => [page.sourceURL, page.sourceID]))
  const ids = new Map<string, number | string>()
  for (const [url, doc] of existingByURL) {
    const sourceID = sourceIDByURL.get(url)
    if (sourceID) ids.set(sourceID, doc.id)
  }

  const transactionID = await payload.db.beginTransaction()
  if (transactionID === null) throw new Error('Database adapter did not start an import transaction')
  const req = { headers: new Headers(), payload, transactionID }
  const results: ImportResult[] = []
  try {
    for (const page of pages) {
      const parentSourceID = page.parentPath
        ? pages.find((candidate) => candidate.path === page.parentPath)?.sourceID
        : null
      if (page.parentPath && !parentSourceID)
        throw new Error(`Invalid import parent path: ${page.parentPath}`)
      const parent = parentSourceID ? ids.get(parentSourceID) : null
      if (parentSourceID && parent === undefined)
        throw new Error(`Parent has not been imported: ${parentSourceID}`)
      const siblings = pages.filter((candidate) => candidate.parentPath === page.parentPath)
      const blocks = resolveBlocks ? await resolveBlocks(page, req) : page.blocks
      const data = {
        _status: 'published',
        content: blocks,
        menuTitle: page.title,
        order: siblings.findIndex((candidate) => candidate.sourceID === page.sourceID),
        parent,
        path: page.path,
        showInMenu: true,
        sourceURL: page.sourceURL,
        title: page.title,
      }
      const existing = existingByURL.get(page.sourceURL)
      if (existing && samePage(existing, data)) {
        ids.set(page.sourceID, existing.id)
        results.push({ sourceID: page.sourceID, sourceURL: page.sourceURL, status: 'imported', reason: 'unchanged' })
        continue
      }
      const saved = existing
        ? await payload.update({ collection: 'pages', data, depth: 0, id: existing.id, req })
        : await payload.create({ collection: 'pages', data, depth: 0, req })
      ids.set(page.sourceID, saved.id)
      results.push({
        sourceID: page.sourceID,
        sourceURL: page.sourceURL,
        status: 'imported',
        reason: existing ? 'updated' : 'created',
      })
    }

    const after = await payload.find({ collection: 'pages', depth: 0, limit: 1000, pagination: false, req })
    const reconciled = after.docs.filter((doc) => sourceURLs.has(String(doc.sourceURL)))
    if (reconciled.length !== pages.length)
      throw new Error(`Incomplete destination reconciliation: ${reconciled.length}/${pages.length}`)
    for (const page of pages) {
      const saved = reconciled.find((doc) => doc.sourceURL === page.sourceURL)
      if (!saved || saved.id !== ids.get(page.sourceID))
        throw new Error(`Incomplete destination reconciliation for ${page.sourceID}`)
    }
    await payload.db.commitTransaction(transactionID)
    return results
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID)
    throw error
  }
}
