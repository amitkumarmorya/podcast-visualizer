import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Podcast Visualizer AI',
  description: 'Transform your podcast scripts into beautiful minimalist visuals.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans bg-[#050505] text-[#ffffff] antialiased selection:bg-[#ccff00] selection:text-[#000000] min-h-screen`}>
        <div className="fixed inset-0 pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_at_top_center,_rgba(204,255,0,0.02)_0%,_transparent_50%)]" />
        <div className="relative z-10 w-full">{children}</div>
      </body>
    </html>
  )
}
