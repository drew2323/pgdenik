import { test, expect } from '@playwright/test'
import {
  cleanupContentFixture,
  fixture,
  seedContentFixture,
} from '../helpers/contentFixture'
import { stubExternalMedia } from '../helpers/stubMedia'

test.describe('Frontend with deterministic CMS content', () => {
  test.beforeAll(async () => {
    await seedContentFixture()
  })

  test.afterAll(async () => {
    await cleanupContentFixture()
  })

  test('renders all four blocks and derives the active branch from CMS parent IDs', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await stubExternalMedia(page)
    await page.goto(fixture.childPath)
    await expect(page.locator('article h1')).toHaveText('Fixture child')
    const navigation = page.getByRole('navigation', { name: 'Hlavní navigace' })
    await expect(navigation.getByRole('link', { name: 'Fixture child' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(navigation.getByRole('link', { name: 'Fixture parent' })).toHaveAttribute(
      'aria-current',
      'location',
    )
    await expect(page.getByText('Fixture article text')).toBeVisible()
    await expect(page.locator('figure img')).toBeVisible()
    await expect(page.locator('.responsive-embed iframe')).toHaveCount(2)
    const articleWidth = await page.locator('article').evaluate((element) => element.getBoundingClientRect().width)
    for (const embed of await page.locator('.responsive-embed').all()) {
      expect(await embed.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThanOrEqual(articleWidth)
    }
    await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true })
  })

  test('redirects a legacy XWiki URL to its current CMS path', async ({ page }) => {
    // Use a space-containing legacy path: the real site's URLs contain spaces
    // and non-ASCII characters, which must still redirect.
    const response = await page.goto('/xwiki/bin/view/Fixture%20lang/Child%20page/')
    await expect(page).toHaveURL(new RegExp(`${fixture.childPath}$`))
    const redirected = response?.request().redirectedFrom()
    expect(redirected).not.toBeNull()
    expect((await redirected?.response())?.status()).toBe(308)
  })

  test('keeps the closed mobile drawer inert and supports keyboard open/close', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(fixture.childPath)
    const button = page.getByRole('button', { name: /Menu/ })
    const drawer = page.locator('#site-navigation')
    await expect(drawer).toHaveAttribute('inert', '')
    await expect(drawer).toHaveAttribute('aria-hidden', 'true')
    await button.focus()
    await page.keyboard.press('Tab')
    expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(false)

    await button.focus()
    await button.press('Enter')
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    await expect(drawer).not.toHaveAttribute('inert', '')
    await expect(drawer).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(drawer.locator('a').first()).toBeFocused()
    await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true })
    await page.keyboard.press('Escape')
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await expect(drawer).toHaveAttribute('inert', '')
    await expect(button).toBeFocused()
  })
})
