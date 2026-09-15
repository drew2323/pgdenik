import React from 'react'
import './styles.css'
import { Navigation } from '@/components/Navigation'
import { getNavigation } from '@/lib/pages'

export const metadata = {
  description: 'Osobní paraglidingový deník — zkušenosti, analýzy letů a poznámky.',
  title: { default: 'PG Deník', template: '%s — PG Deník' },
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="cs">
      <body>
        <a className="skip-link" href="#obsah">
          Přeskočit na obsah
        </a>
        <Navigation items={await getNavigation()} />
        <main id="obsah">{children}</main>
      </body>
    </html>
  )
}
