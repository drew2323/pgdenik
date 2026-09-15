import { test, expect, Page } from '@playwright/test'
import { login } from '../helpers/login'
import { seedTestUser, cleanupTestUser, testUser } from '../helpers/seedUser'
import { cleanupContentFixture, seedContentFixture } from '../helpers/contentFixture'

const lexical = (text: string) => ({
  root: {
    children: [{ children: [{ detail: 0, format: 0, mode: 'normal', style: '', text, type: 'text', version: 1 }], direction: null, format: '', indent: 0, textFormat: 0, textStyle: '', type: 'paragraph', version: 1 }],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
})

test.describe('Payload CMS acceptance', () => {
  test.describe.configure({ timeout: 90_000 })
  let page: Page
  let mediaID: number | string

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000)
    const fixture = await seedContentFixture()
    mediaID = fixture.media.id
    await seedTestUser()
    const context = await browser.newContext({ baseURL: String(testInfo.project.use.baseURL) })
    page = await context.newPage()
    await login({ page, user: testUser })
  })

  test.afterAll(async () => {
    await cleanupTestUser()
    await cleanupContentFixture()
  })

  test('opens the real collection admin', async () => {
    await page.goto('/admin/collections/pages')
    await expect(page).toHaveURL(/\/admin\/collections\/pages(\?.*)?$/)
    await expect(page.locator('h1', { hasText: 'Pages' }).first()).toBeVisible()
    await page.goto('/admin/collections/pages/create')
    await expect(page.locator('input[name="title"]')).toBeVisible()
    await expect(page.locator('input[name="path"]')).toBeVisible()
    await expect(page.locator('input[name="menuTitle"]')).toBeVisible()
    await expect(page.locator('input[name="order"]')).toBeVisible()
  })

  test('creates, edits, publishes, hides, reparents, reorders and controls menu visibility with all blocks', async () => {
    const createdIDs: Array<number | string> = []
    const createPage = async (data: Record<string, unknown>) => {
      const response = await page.request.post('/api/pages', { data })
      expect(response.status()).toBe(201)
      const document = (await response.json()).doc
      createdIDs.push(document.id)
      return document
    }
    try {
      const firstParent = await createPage({
        _status: 'published',
        content: [{ blockType: 'richText', body: lexical('First parent') }],
        order: 1,
        path: '/cms-first-parent',
        showInMenu: true,
        title: 'CMS first parent',
      })
      const secondParent = await createPage({
        _status: 'published',
        content: [{ blockType: 'richText', body: lexical('Second parent') }],
        order: 2,
        path: '/cms-second-parent',
        showInMenu: true,
        title: 'CMS second parent',
      })
      const child = await createPage({
        _status: 'draft',
        content: [
          { blockType: 'richText', body: lexical('Created text') },
          { blockType: 'image', image: mediaID, caption: 'Created image' },
          { blockType: 'youtube', url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' },
          { blockType: 'xcvid', url: 'https://xcvid.com/embed.php?ident=cms%2Fflight' },
        ],
        menuTitle: 'CMS draft child',
        order: 3,
        parent: firstParent.id,
        path: '/cms-child',
        showInMenu: true,
        title: 'CMS draft child',
      })
      expect((await page.request.get('/cms-child')).status()).toBe(404)

      const publish = await page.request.patch(`/api/pages/${child.id}`, {
        data: {
          _status: 'published',
          menuTitle: 'CMS visible child',
          order: 11,
          parent: secondParent.id,
          showInMenu: true,
          title: 'CMS edited child',
        },
      })
      expect(publish.status()).toBe(200)
      const published = (await publish.json()).doc
      expect(published).toMatchObject({
        _status: 'published',
        menuTitle: 'CMS visible child',
        order: 11,
        showInMenu: true,
        title: 'CMS edited child',
      })
      expect(String(published.parent.id ?? published.parent)).toBe(String(secondParent.id))
      expect(published.content.map((block: { blockType: string }) => block.blockType)).toEqual([
        'richText',
        'image',
        'youtube',
        'xcvid',
      ])
      await page.goto('/cms-child')
      await expect(page.locator('article h1')).toHaveText('CMS edited child')
      await expect(page.getByRole('link', { name: 'CMS visible child' })).toBeVisible()

      const hideFromMenu = await page.request.patch(`/api/pages/${child.id}`, {
        data: { order: 42, showInMenu: false },
      })
      expect(hideFromMenu.status()).toBe(200)
      expect((await hideFromMenu.json()).doc).toMatchObject({ order: 42, showInMenu: false })
      await page.reload()
      await expect(page.locator('article h1')).toHaveText('CMS edited child')
      await expect(page.getByRole('link', { name: 'CMS visible child' })).toHaveCount(0)

      const hidePage = await page.request.patch(`/api/pages/${child.id}`, { data: { _status: 'draft' } })
      expect(hidePage.status()).toBe(200)
      expect((await hidePage.json()).doc._status).toBe('draft')
      expect((await page.request.get('/cms-child')).status()).toBe(404)
    } finally {
      for (const id of createdIDs.reverse()) await page.request.delete(`/api/pages/${id}`)
    }
  })
})
