import { describe, expect, it, vi } from 'vitest'
import treeBaseline from '../../artifacts/import/public-tree.json'
import {
  assertAuthoritativeTree,
  importPages,
  type ImportPayload,
  type PreparedImportPage,
} from '@/importer/runner'

const lexical = (text: string) => ({
  root: {
    children: [{ children: [{ text, type: 'text', version: 1 }], type: 'paragraph', version: 1 }],
    type: 'root',
    version: 1,
  },
})

const fixturePages: PreparedImportPage[] = [
  {
    sourceID: 'Main.WebHome',
    sourceParent: '',
    sourceURL: 'https://www.pgdenik.cz/xwiki/bin/view/Main/',
    title: 'Home',
    path: '/',
    parentPath: null,
    blocks: [{ blockType: 'richText', body: lexical('Home') }],
  },
  {
    sourceID: 'Tipy.WebHome',
    sourceParent: 'Main.WebHome',
    sourceURL: 'https://www.pgdenik.cz/xwiki/bin/view/Tipy/',
    title: 'Tipy',
    path: '/tipy',
    parentPath: '/',
    blocks: [{ blockType: 'richText', body: lexical('Tipy') }],
  },
]

function fakePayload(seed: Record<string, unknown>[] = []) {
  let nextID = seed.length + 1
  let docs = structuredClone(seed)
  let snapshot: Record<string, unknown>[] = []
  const payload = {
    db: {
      beginTransaction: vi.fn(async () => 'tx'),
      commitTransaction: vi.fn(async () => undefined),
      rollbackTransaction: vi.fn(async () => {
        docs = snapshot
      }),
    },
    find: vi.fn(async ({ collection, where }: { collection: string; where?: unknown }) => {
      if (collection !== 'pages') return { docs: [] }
      const sourceURL = (where as { sourceURL?: { equals?: string } })?.sourceURL?.equals
      return { docs: sourceURL ? docs.filter((doc) => doc.sourceURL === sourceURL) : docs }
    }),
    create: vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
      if (collection !== 'pages') throw new Error('unexpected collection')
      if (!snapshot.length) snapshot = structuredClone(docs)
      const doc = { ...structuredClone(data), id: nextID++ }
      docs.push(doc)
      return doc
    }),
    update: vi.fn(async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      if (!snapshot.length) snapshot = structuredClone(docs)
      const index = docs.findIndex((doc) => doc.id === id)
      docs[index] = { ...docs[index], ...structuredClone(data) }
      return docs[index]
    }),
  }
  return { payload: payload as unknown as ImportPayload, read: () => docs }
}

describe('fail-closed import reconciliation', () => {
  it('pins the complete 67-page baseline and rejects missing or replacement IDs', () => {
    expect(treeBaseline.pages_count).toBe(67)
    expect(() => assertAuthoritativeTree(treeBaseline.pages.map((page) => page.fullName))).not.toThrow()
    expect(() =>
      assertAuthoritativeTree([
        ...treeBaseline.pages.slice(0, -1).map((page) => page.fullName),
        'Replacement.WebHome',
      ]),
    ).toThrow(/authoritative.*mismatch/i)
    expect(() =>
      assertAuthoritativeTree(treeBaseline.pages.slice(0, -1).map((page) => page.fullName)),
    ).toThrow(/67/)
  })

  it('creates a complete hierarchy atomically and skips all unchanged updates on rerun', async () => {
    const fake = fakePayload()
    const first = await importPages({
      expectedSourceIDs: fixturePages.map((page) => page.sourceID),
      pages: fixturePages,
      payload: fake.payload,
    })
    expect(first.map((entry) => entry.reason)).toEqual(['created', 'created'])
    expect(fake.payload.db.commitTransaction).toHaveBeenCalledOnce()
    expect(fake.read().find((doc) => doc.path === '/tipy')?.parent).toBe(1)

    const updateCalls = (fake.payload.update as ReturnType<typeof vi.fn>).mock.calls.length
    const second = await importPages({
      expectedSourceIDs: fixturePages.map((page) => page.sourceID),
      pages: fixturePages,
      payload: fake.payload,
    })
    expect(second.map((entry) => entry.reason)).toEqual(['unchanged', 'unchanged'])
    expect((fake.payload.update as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(updateCalls)
  })

  it('rolls back and rejects on a page write failure instead of returning partial success', async () => {
    const fake = fakePayload()
    ;(fake.payload.create as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async ({ data }: { data: Record<string, unknown> }) => ({ ...data, id: 1 }),
    ).mockRejectedValueOnce(new Error('write failed'))

    await expect(
      importPages({
        expectedSourceIDs: fixturePages.map((page) => page.sourceID),
        pages: fixturePages,
        payload: fake.payload,
      }),
    ).rejects.toThrow(/write failed/)
    expect(fake.payload.db.rollbackTransaction).toHaveBeenCalledOnce()
    expect(fake.payload.db.commitTransaction).not.toHaveBeenCalled()
  })

  it('rejects stale imported records before writing anything', async () => {
    const fake = fakePayload([
      {
        id: 99,
        sourceURL: 'https://www.pgdenik.cz/xwiki/bin/view/Removed/',
      },
    ])
    await expect(
      importPages({
        expectedSourceIDs: fixturePages.map((page) => page.sourceID),
        pages: fixturePages,
        payload: fake.payload,
      }),
    ).rejects.toThrow(/stale imported/i)
    expect(fake.payload.create).not.toHaveBeenCalled()
  })
})
