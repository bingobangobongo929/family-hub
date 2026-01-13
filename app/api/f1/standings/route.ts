import { NextResponse } from 'next/server'
import { fetchDriverStandings, fetchConstructorStandings } from '@/lib/f1-api'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || '2026')

  try {
    const [drivers, constructors] = await Promise.all([
      fetchDriverStandings(year),
      fetchConstructorStandings(year),
    ])

    return NextResponse.json({ drivers, constructors, year })
  } catch (error) {
    console.error('Error fetching F1 standings:', error)
    return NextResponse.json({ error: 'Failed to fetch standings' }, { status: 500 })
  }
}
