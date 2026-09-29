import './globals.css'
import { Providers } from './providers'

export const metadata = {
  title: 'ShinDora Stream',
  description: 'Bypass Video Generator Embed Otomatis',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html:`
          window.addEventListener('error', function(e) {
            if ((e.error instanceof DOMException && e.error.name === 'NotFoundError') || (e.message && (
              e.message.includes('removeChild') ||
              e.message.includes('not a child of this node') ||
              e.message.includes('Syncing cannot be made') ||
              e.message.includes('TripleLift') ||
              e.message.includes('Bidgency') ||
              e.message.includes('3lift') ||
              e.message.includes('bidgx') ||
              e.message.includes('connatix') ||
              e.message.includes('PerformanceServerTiming')
            ))) {
              e.stopImmediatePropagation();
              e.preventDefault();
            }
          }, true);
          window.addEventListener('unhandledrejection', function(e) {
            if (e.reason && (
              String(e.reason).includes('Syncing cannot be made') ||
              String(e.reason).includes('removeChild') ||
              String(e.reason).includes('3lift') ||
              String(e.reason).includes('bidgx')
            )) {
              e.preventDefault();
            }
          });
        `}} />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
