import { NextRequest, NextResponse } from 'next/server'

interface F1NewsItem {
  id: string
  title: string
  description: string
  link: string
  pubDate: string
  imageUrl?: string
  isInteresting: boolean
  category?: 'race' | 'driver' | 'technical' | 'calendar' | 'other'
}

interface RSSItem {
  title: string
  description: string
  link: string
  pubDate: string
  imageUrl?: string
}

// Model identifiers (same as calendar-ai)
const CLAUDE_MODEL = 'claude-sonnet-4-5-20250514'
const GEMINI_MODEL = 'gemini-3-flash-preview'

// Cache for news items - keyed by model, cached for 30 minutes
const newsCache: Map<string, { items: F1NewsItem[], timestamp: number }> = new Map()
const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes

// Parse RSS pubDate format (e.g., "Thu, 09 Jan 2025 14:30:00 GMT")
function parseRSSDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      // Try alternative parsing
      const match = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})\s+(\d{2}):(\d{2})/)
      if (match) {
        const months: Record<string, number> = {
          Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
          Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
        }
        const d = new Date(
          parseInt(match[3]),
          months[match[2]] || 0,
          parseInt(match[1]),
          parseInt(match[4]),
          parseInt(match[5])
        )
        return d.toISOString()
      }
      return new Date().toISOString()
    }
    return date.toISOString()
  } catch {
    return new Date().toISOString()
  }
}

// Simple XML parser for RSS
function parseRSSItem(itemXml: string): RSSItem | null {
  const getTag = (xml: string, tag: string): string => {
    const cdataMatch = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i'))
    if (cdataMatch) return cdataMatch[1].trim()
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
    return match ? match[1].trim() : ''
  }

  const getAttr = (xml: string, tag: string, attr: string): string => {
    const tagMatch = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*`, 'i'))
    return tagMatch ? tagMatch[1] : ''
  }

  const title = getTag(itemXml, 'title')
  const description = getTag(itemXml, 'description')
  const link = getTag(itemXml, 'link')
  const pubDate = getTag(itemXml, 'pubDate')

  // Try multiple ways to get image
  let imageUrl = getAttr(itemXml, 'media:content', 'url')
    || getAttr(itemXml, 'media:thumbnail', 'url')
    || getAttr(itemXml, 'enclosure', 'url')

  // Extract image from description if present
  if (!imageUrl) {
    const imgMatch = description.match(/<img[^>]+src="([^"]+)"/)
    if (imgMatch) imageUrl = imgMatch[1]
  }

  if (!title || !link) return null

  return {
    title,
    description: description.replace(/<[^>]*>/g, '').substring(0, 500),
    link,
    pubDate: parseRSSDate(pubDate),
    imageUrl,
  }
}

function parseRSS(xml: string): RSSItem[] {
  const items: RSSItem[] = []
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/gi)

  if (itemMatches) {
    for (const itemXml of itemMatches) {
      const item = parseRSSItem(itemXml)
      if (item) items.push(item)
    }
  }

  return items
}

// Try to fetch Open Graph image from article URL
async function fetchOGImage(url: string): Promise<string | undefined> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Family-Hub/1.0' },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) return undefined

    const html = await response.text()
    const ogMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
      || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i)

    return ogMatch ? ogMatch[1] : undefined
  } catch {
    return undefined
  }
}

const FILTER_PROMPT = `You are filtering Formula 1 news articles for a family dashboard.

For each article, determine:
1. Is it INTERESTING? (true/false)
2. What CATEGORY does it belong to?

INTERESTING articles contain:
- Race results, qualifying, sprint results
- Driver/team news (transfers, contracts, retirements)
- Technical updates (car upgrades, rule changes)
- Championship standings changes
- Important incidents or penalties
- Calendar/track changes

NOT INTERESTING:
- Promotional content ("Best moments of...")
- Social media roundups, fan polls
- Old news repackaged
- Behind-the-scenes fluff

CATEGORIES:
- "race" = Race/qualifying/sprint results, race weekends
- "driver" = Driver news, transfers, contracts, interviews
- "technical" = Car updates, regulations, tech analysis
- "calendar" = Schedule changes, track news
- "other" = Everything else

Return JSON: {"results": [{"index": 0, "interesting": true, "category": "race"}, ...]}

Articles:`

// Filter with Claude
async function filterWithClaude(items: RSSItem[]): Promise<{interesting: boolean, category: string}[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('No Anthropic API key')

  const itemsForAnalysis = items.slice(0, 25).map((item, i) => ({
    index: i,
    title: item.title,
    description: item.description.substring(0, 150),
  }))

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `${FILTER_PROMPT}\n${JSON.stringify(itemsForAnalysis, null, 2)}`,
      }],
    }),
  })

  if (!response.ok) throw new Error('Claude API failed')

  const aiResponse = await response.json()
  const content = aiResponse.content?.[0]?.text || '{}'

  const jsonMatch = content.match(/\{[\s\S]*"results"[\s\S]*\}/)
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0])
    const resultsMap = new Map(parsed.results?.map((r: any) => [r.index, r]) || [])
    return items.map((_, i) => {
      const result = resultsMap.get(i) as any
      return {
        interesting: result?.interesting ?? false,
        category: result?.category || 'other'
      }
    })
  }
  return items.map(() => ({ interesting: true, category: 'other' }))
}

// Filter with Gemini
async function filterWithGemini(items: RSSItem[]): Promise<{interesting: boolean, category: string}[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('No Google AI API key')

  const itemsForAnalysis = items.slice(0, 25).map((item, i) => ({
    index: i,
    title: item.title,
    description: item.description.substring(0, 150),
  }))

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${FILTER_PROMPT}\n${JSON.stringify(itemsForAnalysis, null, 2)}`,
          }],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      }),
    }
  )

  if (!response.ok) throw new Error('Gemini API failed')

  const aiResponse = await response.json()
  const content = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

  const jsonMatch = content.match(/\{[\s\S]*"results"[\s\S]*\}/)
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0])
    const resultsMap = new Map(parsed.results?.map((r: any) => [r.index, r]) || [])
    return items.map((_, i) => {
      const result = resultsMap.get(i) as any
      return {
        interesting: result?.interesting ?? false,
        category: result?.category || 'other'
      }
    })
  }
  return items.map(() => ({ interesting: true, category: 'other' }))
}

// Main filter function
async function filterWithAI(items: RSSItem[], model: 'claude' | 'gemini'): Promise<F1NewsItem[]> {
  let classifications: {interesting: boolean, category: string}[] = []

  try {
    if (model === 'gemini') {
      classifications = await filterWithGemini(items)
    } else {
      classifications = await filterWithClaude(items)
    }
  } catch (error) {
    console.error('AI filtering error:', error)
    // On error, mark first 10 as interesting
    classifications = items.map((_, i) => ({
      interesting: i < 10,
      category: 'other' as const
    }))
  }

  // Fetch OG images for items without images (limit to 5 to avoid slowdown)
  const needsImage = items
    .map((item, i) => ({ item, index: i }))
    .filter(({ item }) => !item.imageUrl)
    .slice(0, 5)

  const ogImages = await Promise.all(
    needsImage.map(async ({ item, index }) => ({
      index,
      imageUrl: await fetchOGImage(item.link)
    }))
  )
  const ogImageMap = new Map(ogImages.map(o => [o.index, o.imageUrl]))

  return items.map((item, i) => ({
    id: `f1-news-${i}-${Date.now()}`,
    title: item.title,
    description: item.description,
    link: item.link,
    pubDate: item.pubDate,
    imageUrl: item.imageUrl || ogImageMap.get(i),
    isInteresting: classifications[i]?.interesting ?? true,
    category: (classifications[i]?.category || 'other') as F1NewsItem['category'],
  }))
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const model = (searchParams.get('model') || 'claude') as 'claude' | 'gemini'
  const forceRefresh = searchParams.get('refresh') === 'true'

  // Check cache (keyed by model)
  const cacheKey = model
  const cached = newsCache.get(cacheKey)

  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return NextResponse.json({
      items: cached.items,
      cached: true,
      timestamp: cached.timestamp,
      cacheAge: Math.round((Date.now() - cached.timestamp) / 1000 / 60), // minutes
    })
  }

  try {
    // Fetch F1 RSS feed
    const rssUrl = 'https://www.formula1.com/en/latest/all.xml'
    const response = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Family-Hub/1.0' },
      cache: 'no-store', // Always fetch fresh RSS
    })

    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status}`)
    }

    const xml = await response.text()
    const rssItems = parseRSS(xml)

    // Filter with AI using selected model
    const filteredItems = await filterWithAI(rssItems, model)

    // Update cache
    newsCache.set(cacheKey, {
      items: filteredItems,
      timestamp: Date.now(),
    })

    return NextResponse.json({
      items: filteredItems,
      cached: false,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('F1 news fetch error:', error)

    // Return cached data if available (even if stale)
    if (cached) {
      return NextResponse.json({
        items: cached.items,
        cached: true,
        stale: true,
        timestamp: cached.timestamp,
      })
    }

    return NextResponse.json(
      { error: 'Failed to fetch F1 news', items: [] },
      { status: 500 }
    )
  }
}
