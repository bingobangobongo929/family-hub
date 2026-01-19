import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Family Hub',
    short_name: 'Family Hub',
    description: 'Your family command center - calendar, tasks, routines, and more',
    start_url: '/',
    display: 'standalone',
    background_color: '#f0fdfa',
    theme_color: '#14b8a6',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
