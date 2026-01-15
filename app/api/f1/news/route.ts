import { NextResponse } from 'next/server'

interface F1NewsItem {
  id: string
  title: string
  description: string
  link: string
  pubDate: string
  imageUrl?: string
  isInteresting: boolean
  category?: string
}

interface RSSItem {
  title: string
  description: string
  link: string
  pubDate: string
  'media:content'?: { $: { url: string } }
  enclosure?: { $: { url: string } }
}

// Cache for news items (5 minute cache)
let newsCache: { items: F1NewsItem[], timestamp: number } | null = null
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Simple XML to JSON parser for RSS
function parseRSSItem(itemXml: string): RSSItem | null {
  const getTag = (xml: string, tag: string): string => {
    // Handle CDATA
    const cdataMatch = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i'))
    if (cdataMatch) return cdataMatch[1].trim()

    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
    return match ? match[1].trim() : ''
  }

  const getAttr = (xml: string, tag: string, attr: string): string => {
    const tagMatch = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*>`, 'i'))
    return tagMatch ? tagMatch[1] : ''
  }

  const title = getTag(itemXml, 'title')
  const description = getTag(itemXml, 'description')
  const link = getTag(itemXml, 'link')
  const pubDate = getTag(itemXml, 'pubDate')
  const mediaUrl = getAttr(itemXml, 'media:content', 'url') || getAttr(itemXml, 'enclosure', 'url')

  if (!title || !link) return null

  return {
    title,
    description: description.replace(/<[^>]*>/g, '').substring(0, 300), // Strip HTML, limit length
    link,
    pubDate,
    'media:content': mediaUrl ? { $: { url: mediaUrl } } : undefined,
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

// Use AI to filter interesting news
async function filterWithAI(items: RSSItem[]): Promise<F1NewsItem[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  // If no API key, return all items as "interesting"
  if (!apiKey) {
    return items.map((item, i) => ({
      id: `f1-news-${i}-${Date.now()}`,
      title: item.title,
      description: item.description,
      link: item.link,
      pubDate: item.pubDate,
      imageUrl: item['media:content']?.$.url || item.enclosure?.$.url,
      isInteresting: true,
    }))
  }

  // Prepare items for AI analysis
  const itemsForAnalysis = items.slice(0, 20).map((item, i) => ({
    index: i,
    title: item.title,
    description: item.description.substring(0, 200),
  }))

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `You are filtering Formula 1 news articles for a family dashboard.

Mark articles as INTERESTING if they contain:
- Race results, qualifying results, sprint results
- Driver/team news (transfers, contracts, retirements)
- Technical updates (car upgrades, rule changes)
- Championship standings changes
- Important incidents or penalties
- Track/calendar changes
- Weather affecting races

Mark as NOT INTERESTING if they are:
- Generic promotional content ("Best moments of...")
- Repetitive daily updates with no substance
- Social media roundups
- Fan polls or quizzes
- Old news repackaged
- Behind-the-scenes fluff pieces

Analyze these articles and return a JSON array with the index numbers of INTERESTING articles only.

Articles:
${JSON.stringify(itemsForAnalysis, null, 2)}

Return ONLY a JSON object like: {"interesting": [0, 2, 5, 7]}`,
        }],
      }),
    })

    if (!response.ok) {
      console.error('AI filtering failed, returning all items')
      return items.map((item, i) => ({
        id: `f1-news-${i}-${Date.now()}`,
        title: item.title,
        description: item.description,
        link: item.link,
        pubDate: item.pubDate,
        imageUrl: item['media:content']?.$.url,
        isInteresting: true,
      }))
    }

    const aiResponse = await response.json()
    const content = aiResponse.content?.[0]?.text || '{}'

    // Parse AI response
    let interestingIndices: number[] = []
    try {
      const jsonMatch = content.match(/\{[\s\S]*"interesting"[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        interestingIndices = parsed.interesting || []
      }
    } catch (e) {
      console.error('Failed to parse AI response:', e)
      // If parsing fails, mark first 5 as interesting
      interestingIndices = [0, 1, 2, 3, 4]
    }

    // Build response with AI filtering
    return items.map((item, i) => ({
      id: `f1-news-${i}-${Date.now()}`,
      title: item.title,
      description: item.description,
      link: item.link,
      pubDate: item.pubDate,
      imageUrl: item['media:content']?.$.url,
      isInteresting: interestingIndices.includes(i),
    }))
  } catch (error) {
    console.error('AI filtering error:', error)
    // Return all items as interesting on error
    return items.map((item, i) => ({
      id: `f1-news-${i}-${Date.now()}`,
      title: item.title,
      description: item.description,
      link: item.link,
      pubDate: item.pubDate,
      imageUrl: item['media:content']?.$.url,
      isInteresting: true,
    }))
  }
}

export async function GET() {
  // Check cache
  if (newsCache && Date.now() - newsCache.timestamp < CACHE_DURATION) {
    return NextResponse.json({
      items: newsCache.items,
      cached: true,
      timestamp: newsCache.timestamp,
    })
  }

  try {
    // Fetch F1 RSS feed
    const rssUrl = 'https://www.formula1.com/en/latest/all.xml'
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Family-Hub/1.0',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    })

    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status}`)
    }

    const xml = await response.text()
    const rssItems = parseRSS(xml)

    // Filter with AI
    const filteredItems = await filterWithAI(rssItems)

    // Update cache
    newsCache = {
      items: filteredItems,
      timestamp: Date.now(),
    }

    return NextResponse.json({
      items: filteredItems,
      cached: false,
      timestamp: newsCache.timestamp,
    })
  } catch (error) {
    console.error('F1 news fetch error:', error)

    // Return cached data if available
    if (newsCache) {
      return NextResponse.json({
        items: newsCache.items,
        cached: true,
        stale: true,
        timestamp: newsCache.timestamp,
      })
    }

    return NextResponse.json(
      { error: 'Failed to fetch F1 news', items: [] },
      { status: 500 }
    )
  }
}
