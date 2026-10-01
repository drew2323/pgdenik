import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import HomePage from '@/app/(frontend)/page'

vi.mock('@/lib/pages', () => ({
  getPublicPages: async () => ({
    docs: [
      {
        id: 'home',
        title: 'PG Deník',
        path: '/',
        parent: null,
        content: [],
      },
    ],
  }),
  pagesToChildItems: () => [],
}))

describe('homepage', () => {
  it('identifies the site as a personal paragliding diary', async () => {
    render(await HomePage())

    expect(screen.getByText('Osobní paraglidingový deník', { exact: true })).toBeTruthy()
  })
})
