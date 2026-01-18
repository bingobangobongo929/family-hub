import { NextRequest, NextResponse } from 'next/server'

// F1 Fantasy API - Public endpoints (no authentication required)
// Base URL: https://fantasy-api.formula1.com/f1/{year}/

const F1_FANTASY_BASE = 'https://fantasy-api.formula1.com/f1'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

interface CacheEntry {
  data: any
  timestamp: number
}

// In-memory cache
const cache: Record<string, CacheEntry> = {}

function getCached(key: string): any | null {
  const entry = cache[key]
  if (entry && Date.now() - entry.timestamp < CACHE_DURATION) {
    return entry.data
  }
  return null
}

function setCache(key: string, data: any) {
  cache[key] = { data, timestamp: Date.now() }
}

// Fetch with retry logic
async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FamilyHub/1.0',
        },
      })
      if (response.ok) return response
      if (response.status === 429) {
        // Rate limited, wait and retry
        await new Promise(r => setTimeout(r, 1000 * (i + 1)))
        continue
      }
      throw new Error(`HTTP ${response.status}`)
    } catch (error) {
      if (i === retries - 1) throw error
      await new Promise(r => setTimeout(r, 500))
    }
  }
  throw new Error('Max retries exceeded')
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year') || '2026'
  const endpoint = searchParams.get('endpoint') || 'players'

  const cacheKey = `fantasy-${year}-${endpoint}`
  const cached = getCached(cacheKey)
  if (cached) {
    return NextResponse.json({ ...cached, cached: true })
  }

  try {
    let data: any = null

    switch (endpoint) {
      case 'players': {
        // Get all drivers with prices
        const response = await fetchWithRetry(`${F1_FANTASY_BASE}/${year}/players`)
        const playersData = await response.json()

        // Transform to our format
        data = {
          players: (playersData.players || []).map((p: any) => ({
            id: p.id,
            firstName: p.first_name,
            lastName: p.last_name,
            teamId: p.team_id,
            teamName: p.team_name,
            price: p.price, // In millions (e.g., 30.5 = £30.5m)
            priceChange: p.price_change_info?.current_price_change || 0,
            priceChangeWeek: p.price_change_info?.weekly_price_change || 0,
            seasonPoints: p.season_score || 0,
            imageUrl: p.image_urls?.profile_image,
            headshot: p.headshot_url,
            position: p.position,
            isConstructor: false,
          })),
          timestamp: Date.now(),
        }
        break
      }

      case 'teams': {
        // Get all constructors with prices
        const response = await fetchWithRetry(`${F1_FANTASY_BASE}/${year}/teams`)
        const teamsData = await response.json()

        data = {
          teams: (teamsData.teams || []).map((t: any) => ({
            id: t.id,
            name: t.name,
            shortName: t.short_name,
            price: t.price,
            priceChange: t.price_change_info?.current_price_change || 0,
            priceChangeWeek: t.price_change_info?.weekly_price_change || 0,
            seasonPoints: t.season_score || 0,
            logoUrl: t.team_logo,
            color: t.team_colour,
            isConstructor: true,
          })),
          timestamp: Date.now(),
        }
        break
      }

      case 'game': {
        // Get game info (deadlines, current game period, etc.)
        const response = await fetchWithRetry(`${F1_FANTASY_BASE}/${year}`)
        const gameData = await response.json()

        data = {
          season: gameData.season,
          currentGamePeriod: gameData.current_game_period,
          nextDeadline: gameData.next_deadline,
          gamePeriods: (gameData.game_periods || []).map((gp: any) => ({
            id: gp.id,
            name: gp.name,
            deadline: gp.deadline,
            status: gp.status,
            circuitId: gp.circuit_id,
          })),
          timestamp: Date.now(),
        }
        break
      }

      case 'all': {
        // Fetch all public data at once
        const [playersRes, teamsRes, gameRes] = await Promise.all([
          fetchWithRetry(`${F1_FANTASY_BASE}/${year}/players`).catch(() => null),
          fetchWithRetry(`${F1_FANTASY_BASE}/${year}/teams`).catch(() => null),
          fetchWithRetry(`${F1_FANTASY_BASE}/${year}`).catch(() => null),
        ])

        const playersData = playersRes ? await playersRes.json() : { players: [] }
        const teamsData = teamsRes ? await teamsRes.json() : { teams: [] }
        const gameData = gameRes ? await gameRes.json() : {}

        data = {
          players: (playersData.players || []).map((p: any) => ({
            id: p.id,
            firstName: p.first_name,
            lastName: p.last_name,
            teamId: p.team_id,
            teamName: p.team_name,
            price: p.price,
            priceChange: p.price_change_info?.current_price_change || 0,
            priceChangeWeek: p.price_change_info?.weekly_price_change || 0,
            seasonPoints: p.season_score || 0,
            headshot: p.headshot_url,
            isConstructor: false,
          })),
          teams: (teamsData.teams || []).map((t: any) => ({
            id: t.id,
            name: t.name,
            shortName: t.short_name,
            price: t.price,
            priceChange: t.price_change_info?.current_price_change || 0,
            priceChangeWeek: t.price_change_info?.weekly_price_change || 0,
            seasonPoints: t.season_score || 0,
            logoUrl: t.team_logo,
            color: t.team_colour,
            isConstructor: true,
          })),
          game: {
            season: gameData.season,
            currentGamePeriod: gameData.current_game_period,
            nextDeadline: gameData.next_deadline,
            gamePeriods: (gameData.game_periods || []).map((gp: any) => ({
              id: gp.id,
              name: gp.name,
              deadline: gp.deadline,
              status: gp.status,
            })),
          },
          timestamp: Date.now(),
        }
        break
      }

      default:
        return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
    }

    setCache(cacheKey, data)
    return NextResponse.json({ ...data, cached: false })

  } catch (error) {
    console.error('[F1 Fantasy API] Error:', error)

    // Return cached data if available, even if stale
    const staleCache = cache[cacheKey]
    if (staleCache) {
      return NextResponse.json({ ...staleCache.data, cached: true, stale: true })
    }

    return NextResponse.json(
      { error: 'Failed to fetch F1 Fantasy data', details: String(error) },
      { status: 500 }
    )
  }
}
