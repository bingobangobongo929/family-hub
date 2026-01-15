import { NextResponse } from 'next/server'
import { fetchDriverStandings, fetchConstructorStandings, F1Driver, F1Constructor } from '@/lib/f1-api'

// Cache for standings data (15 minutes - more frequent updates during race weekends)
let standingsCache: {
  data: { drivers: F1Driver[], constructors: F1Constructor[], year: number }
  timestamp: number
  year: number
} | null = null
const CACHE_DURATION = 15 * 60 * 1000 // 15 minutes

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || '2026')

  // Check cache
  if (standingsCache && standingsCache.year === year && Date.now() - standingsCache.timestamp < CACHE_DURATION) {
    return NextResponse.json({ ...standingsCache.data, cached: true })
  }

  try {
    const [drivers, constructors] = await Promise.all([
      fetchDriverStandings(year),
      fetchConstructorStandings(year),
    ])

    // Update cache
    standingsCache = {
      data: { drivers, constructors, year },
      timestamp: Date.now(),
      year,
    }

    return NextResponse.json({ drivers, constructors, year, cached: false })
  } catch (error) {
    console.error('Error fetching F1 standings:', error)

    // Return stale cache if available
    if (standingsCache && standingsCache.year === year) {
      return NextResponse.json({ ...standingsCache.data, cached: true, stale: true })
    }

    return NextResponse.json({ error: 'Failed to fetch standings' }, { status: 500 })
  }
}
