import { NextRequest, NextResponse } from 'next/server'

interface F1NewsItem {
  id: string
  title: string
  description: string
  link: string
  pubDate: string
  imageUrl?: string
  isInteresting: boolean
}

interface RSSItem {
  title: string
  description: string
  link: string
  pubDate: string
  'media:content'?: { $: { url: string } }
  enclosure?: { $: { url: string } }
}

// Model identifiers (same as calendar-ai)
const CLAUDE_MODEL = 'claude-sonnet-4-5-20250514'
const GEMINI_MODEL = 'gemini-3-flash-preview'

// Cache for news items (5 minute cache)
let newsCache: { items: F1NewsItem[], timestamp: number } | null = null
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Simple XML to JSON parser for RSS
function parseRSSItem(itemXml: string): RSSItem | null {
  const getTag = (xml: string, tag: string): string => {
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
    description: description.replace(/<[^>]*>/g, '').substring(0, 300),
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

const FILTER_PROMPT = `You are filtering Formula 1 news articles for a family dashboard.

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

Analyze these articles and return ONLY a JSON object with the index numbers of INTERESTING articles.
Example response: {"interesting": [0, 2, 5, 7]}

Articles:`

// Filter with Claude
async function filterWithClaude(items: RSSItem[]): Promise<number[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('No Anthropic API key')

  const itemsForAnalysis = items.slice(0, 20).map((item, i) => ({
    index: i,
    title: item.title,
    description: item.description.substring(0, 200),
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
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `${FILTER_PROMPT}\n${JSON.stringify(itemsForAnalysis, null, 2)}`,
      }],
    }),
  })

  if (!response.ok) throw new Error('Claude API failed')

  const aiResponse = await response.json()
  const content = aiResponse.content?.[0]?.text || '{}'

  const jsonMatch = content.match(/\{[\s\S]*"interesting"[\s\S]*\}/)
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0])
    return parsed.interesting || []
  }
  return []
}

// Filter with Gemini
async function filterWithGemini(items: RSSItem[]): Promise<number[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('No Google AI API key')

  const itemsForAnalysis = items.slice(0, 20).map((item, i) => ({
    index: i,
    title: item.title,
    description: item.description.substring(0, 200),
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
          maxOutputTokens: 512,
        },
      }),
    }
  )

  if (!response.ok) throw new Error('Gemini API failed')

  const aiResponse = await response.json()
  const content = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

  const jsonMatch = content.match(/\{[\s\S]*"interesting"[\s\S]*\}/)
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0])
    return parsed.interesting || []
  }
  return []
}

// Main filter function
async function filterWithAI(items: RSSItem[], model: 'claude' | 'gemini'): Promise<F1NewsItem[]> {
  let interestingIndices: number[] = []

  try {
    if (model === 'gemini') {
      interestingIndices = await filterWithGemini(items)
    } else {
      interestingIndices = await filterWithClaude(items)
    }
  } catch (error) {
    console.error('AI filtering error:', error)
    // On error, mark first 5 as interesting
    interestingIndices = [0, 1, 2, 3, 4]
  }

  return items.map((item, i) => ({
    id: `f1-news-${i}-${Date.now()}`,
    title: item.title,
    description: item.description,
    link: item.link,
    pubDate: item.pubDate,
    imageUrl: item['media:content']?.$.url,
    isInteresting: interestingIndices.includes(i),
  }))
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const model = (searchParams.get('model') || 'claude') as 'claude' | 'gemini'

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
      headers: { 'User-Agent': 'Family-Hub/1.0' },
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status}`)
    }

    const xml = await response.text()
    const rssItems = parseRSS(xml)

    // Filter with AI using selected model
    const filteredItems = await filterWithAI(rssItems, model)

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
