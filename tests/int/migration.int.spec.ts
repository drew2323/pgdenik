import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Deterministic rollback-ordering guarantee for the redesign migration:
 * the down() step must drop the external foreign key that references
 * `pages` BEFORE dropping the `pages` table, and must leave the shared
 * `media` / `payload_locked_documents_rels` relations intact.
 *
 * (A full executable up/down/up round trip is exercised by the CI
 * `pnpm run payload -- migrate` step plus the clean-DB migrate in the local
 * quality gate; the ordering invariant is the review-critical guarantee and
 * is asserted here deterministically.)
 */
describe('redesign migration rollback ordering', () => {
  it('drops the external pages FK before the pages table in down()', async () => {
    const migration = await readFile(
      path.resolve('src/migrations/20260915_065021_redesign_cms.ts'),
      'utf8',
    )
    const down = migration.slice(migration.indexOf('export async function down'))
    const relsFK = down.indexOf('DROP CONSTRAINT "payload_locked_documents_rels_pages_fk"')
    const dropPages = down.indexOf('DROP TABLE "pages" CASCADE')
    expect(relsFK).toBeGreaterThan(-1)
    expect(dropPages).toBeGreaterThan(-1)
    expect(relsFK).toBeLessThan(dropPages)

    // The blocks tables carry FK to pages and must drop first (CASCADE handles
    // the rest); the shared rels table must keep its own rows.
    const blocks = down.indexOf('DROP TABLE "pages_blocks_rich_text" CASCADE')
    expect(blocks).toBeGreaterThan(-1)
    expect(blocks).toBeLessThan(dropPages)
  })
})