import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Login - Dashboard',
  description: '3D Animated Login Page',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
