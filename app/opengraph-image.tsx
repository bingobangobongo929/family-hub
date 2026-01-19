import { ImageResponse } from 'next/og'

export const alt = 'Family Hub - Your family command center'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

// Force dynamic to allow reading icon at runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function OGImage() {
  // Fetch icon from public folder at runtime
  const iconUrl = new URL('/icon-512.png', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 25%, #99f6e4 50%, #5eead4 75%, #14b8a6 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Icon placeholder - using SVG house icon since we can't read files during static gen */}
        <div
          style={{
            width: 180,
            height: 180,
            borderRadius: 40,
            background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}
        >
          <svg
            width="100"
            height="100"
            viewBox="0 0 24 24"
            fill="none"
            style={{ color: 'white' }}
          >
            <path
              d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.5523 5.44772 21 6 21H9M19 10L21 12M19 10V20C19 20.5523 18.5523 21 18 21H15M9 21C9.55228 21 10 20.5523 10 20V16C10 15.4477 10.4477 15 11 15H13C13.5523 15 14 15.4477 14 16V20C14 20.5523 14.4477 21 15 21M9 21H15"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            marginTop: 40,
            fontSize: 64,
            fontWeight: 700,
            color: '#0f172a',
            letterSpacing: '-0.02em',
          }}
        >
          Family Hub
        </div>

        {/* Subtitle */}
        <div
          style={{
            marginTop: 16,
            fontSize: 28,
            color: '#475569',
          }}
        >
          Your family command center
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
