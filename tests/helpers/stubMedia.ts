import type { Page } from '@playwright/test'

/**
 * Keeps E2E offline-deterministic: external iframes (YouTube/XCvid) and
 * remote images are stubbed with an immediate empty reply so the suite never
 * waits on third-party network latency. The block structure still renders and
 * is asserted (iframe/edge-to-edge present), only the remote resource is static.
 */
export async function stubExternalMedia(page: Page): Promise<void> {
  for (const url of [
    'https://www.youtube-nocookie.com/**',
    'https://www.youtube.com/**',
    'https://youtube.com/**',
    'https://xcvid.com/**',
    'http://xcvid.com/**',
    'https://www.pgdenik.cz/xwiki/bin/download/**',
  ]) {
    await page.route(url, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '' }),
    )
  }
}