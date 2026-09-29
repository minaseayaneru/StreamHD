import './globals.css'
import { Providers } from './providers'

export const metadata = {
  title: 'ShinDora Stream',
  description: 'Bypass Video Generator Embed Otomatis',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
