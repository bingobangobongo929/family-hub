import { NextRequest, NextResponse } from 'next/server'

interface F1NewsItem {
  id: string
  title: string
  description: string
  link: string
  pubDate: string
  imageUrl?: string
  isInteresting: boolean
  isSpoiler: boolean
  category?: 'race' | 'driver' | 'technical' | 'calendar' | 'other'
}

interface RSSItem {
  title: string
  description: string
  link: string
  pubDate: string
  imageUrl?: string
}

interface ClassificationResult {
  isInteresting: boolean
  category: 'race' | 'driver' | 'technical' | 'calendar' | 'other'
  isSpoiler: boolean
  classifiedAt: number
}

// Model identifiers (same as calendar-ai)
const CLAUDE_MODEL = 'claude-sonnet-4-5-20250514'
const GEMINI_MODEL = 'gemini-3-flash-preview'

// Persistent cache of article classifications (by URL) - survives across requests
// Key = article link URL, Value = classification result
const classificationCache: Map<string, ClassificationResult> = new Map()

// Cache for article metadata (OG image + date) - survives across requests
const articleMetaCache: Map<string, { imageUrl: string | null, publishDate: string | null }> = new Map()

// Cache for final news response (short-lived, just to avoid re-fetching RSS too often)
let responseCache: { items: F1NewsItem[], timestamp: number } | null = null
const RESPONSE_CACHE_DURATION = 10 * 60 * 1000 // 10 minutes for RSS refresh

// Parse RSS pubDate format - returns empty string if no valid date
function parseRSSDate(dateStr: string): string {
  if (!dateStr) {
    return '' // F1 RSS doesn't include pubDate
  }

  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      // Try manual parsing for formats like "15 Jan 2026 14:30"
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
      return '' // No valid date
    }
    return date.toISOString()
  } catch {
    return '' // No valid date
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

  let imageUrl = getAttr(itemXml, 'media:content', 'url')
    || getAttr(itemXml, 'media:thumbnail', 'url')
    || getAttr(itemXml, 'enclosure', 'url')

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

// Fetch article metadata (OG image + publish date) from article URL
async function fetchArticleMeta(url: string): Promise<{ imageUrl: string | null, publishDate: string | null }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Family-Hub/1.0)',
        'Accept': 'text/html',
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return { imageUrl: null, publishDate: null }
    }

    const html = await response.text()
    let imageUrl: string | null = null
    let publishDate: string | null = null

    // Try multiple patterns for og:image
    const imagePatterns = [
      /<meta\s+property="og:image"\s+content="([^"]+)"/i,
      /<meta\s+content="([^"]+)"\s+property="og:image"/i,
      /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i,
      /<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i,
    ]

    for (const pattern of imagePatterns) {
      const match = html.match(pattern)
      if (match) {
        imageUrl = match[1]
        break
      }
    }

    // Try to extract publish date from article:published_time or datePublished
    const datePatterns = [
      /<meta\s+property="article:published_time"\s+content="([^"]+)"/i,
      /<meta\s+content="([^"]+)"\s+property="article:published_time"/i,
      /<meta[^>]+property="article:published_time"[^>]+content="([^"]+)"/i,
      /"datePublished"\s*:\s*"([^"]+)"/i,
    ]

    for (const pattern of datePatterns) {
      const match = html.match(pattern)
      if (match) {
        publishDate = match[1]
        break
      }
    }

    return { imageUrl, publishDate }
  } catch {
    return { imageUrl: null, publishDate: null }
  }
}

const FILTER_PROMPT = `You are filtering Formula 1 news articles for a family dashboard.

For each article, determine:
1. Is it INTERESTING? (true/false)
2. What CATEGORY does it belong to?
3. Is it a SPOILER? (true/false)

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

SPOILERS (true if article reveals):
- Race results, winners, podium finishers
- Qualifying positions/results
- Sprint race results
- Practice session times/results
- Championship standings updates after a race
- Penalty decisions affecting race results
- Major incidents with outcomes (crashes, DNFs with driver names)
- Any headline that reveals who won, finished where, or standings changes

NOT SPOILERS:
- Pre-race previews, predictions
- Driver/team news not about results
- Technical analysis without result info
- Calendar/schedule changes
- General F1 news

Return JSON: {"results": [{"index": 0, "interesting": true, "category": "race", "spoiler": true}, ...]}

Articles:`

// Classify articles with Claude (only new ones)
async function classifyWithClaude(items: { index: number, title: string, description: string }[]): Promise<Map<number, { interesting: boolean, category: string, spoiler: boolean }>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('No Anthropic API key')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `${FILTER_PROMPT}\n${JSON.stringify(items, null, 2)}`,
      }],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Claude API error:', error)
    throw new Error('Claude API failed')
  }

  const data = await response.json()
  const content = data.content?.find((c: any) => c.type === 'text')?.text || '{}'

  console.log('Claude raw response:', content.substring(0, 800))

  const resultMap = new Map<number, { interesting: boolean, category: string, spoiler: boolean }>()

  // Try to extract JSON - handle markdown code blocks
  let jsonStr = content
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim()
  }

  try {
    // Try direct parse first
    const parsed = JSON.parse(jsonStr)
    const results = parsed.results || []
    console.log('Parsed', results.length, 'results, first 3:', JSON.stringify(results.slice(0, 3)))
    for (const r of results) {
      resultMap.set(r.index, {
        interesting: r.interesting ?? false,
        category: r.category || 'other',
        spoiler: r.spoiler ?? false
      })
    }
  } catch {
    // Try regex extraction as fallback
    const jsonMatch = jsonStr.match(/\{[\s\S]*"results"[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        console.log('Regex parsed results:', JSON.stringify(parsed.results?.slice(0, 3)))
        for (const r of (parsed.results || [])) {
          resultMap.set(r.index, {
            interesting: r.interesting ?? false,
            category: r.category || 'other',
            spoiler: r.spoiler ?? false
          })
        }
      } catch (e) {
        console.error('JSON parse error:', e)
      }
    } else {
      console.error('No JSON match found in:', jsonStr.substring(0, 300))
    }
  }
  return resultMap
}

// Classify articles with Gemini (only new ones)
async function classifyWithGemini(items: { index: number, title: string, description: string }[]): Promise<Map<number, { interesting: boolean, category: string, spoiler: boolean }>> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('No Google AI API key')

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${FILTER_PROMPT}\n${JSON.stringify(items, null, 2)}`,
          }],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error('Gemini API error:', error)
    throw new Error('Gemini API failed')
  }

  const data = await response.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

  console.log('Gemini raw response:', content.substring(0, 800))

  const resultMap = new Map<number, { interesting: boolean, category: string, spoiler: boolean }>()

  // Try to extract JSON - handle markdown code blocks
  let jsonStr = content
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim()
  }

  try {
    // Try direct parse first
    const parsed = JSON.parse(jsonStr)
    const results = parsed.results || []
    console.log('Parsed', results.length, 'results, first 3:', JSON.stringify(results.slice(0, 3)))
    for (const r of results) {
      resultMap.set(r.index, {
        interesting: r.interesting ?? false,
        category: r.category || 'other',
        spoiler: r.spoiler ?? false
      })
    }
  } catch {
    // Try regex extraction as fallback
    const jsonMatch = jsonStr.match(/\{[\s\S]*"results"[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        console.log('Regex parsed results:', JSON.stringify(parsed.results?.slice(0, 3)))
        for (const r of (parsed.results || [])) {
          resultMap.set(r.index, {
            interesting: r.interesting ?? false,
            category: r.category || 'other',
            spoiler: r.spoiler ?? false
          })
        }
      } catch (e) {
        console.error('JSON parse error:', e)
      }
    } else {
      console.error('No JSON match found in:', jsonStr.substring(0, 300))
    }
  }
  return resultMap
}

// Main function to get classifications (uses cache, only classifies new articles)
async function getClassifications(items: RSSItem[], model: 'claude' | 'gemini'): Promise<F1NewsItem[]> {
  // Find which articles need classification
  const needsClassification: { index: number, item: RSSItem }[] = []

  for (let i = 0; i < items.length; i++) {
    const cached = classificationCache.get(items[i].link)
    if (!cached) {
      needsClassification.push({ index: i, item: items[i] })
    }
  }

  // Classify new articles with AI (if any)
  if (needsClassification.length > 0) {
    console.log(`Classifying ${needsClassification.length} new articles (${items.length - needsClassification.length} from cache)`)

    const itemsForAI = needsClassification.map(({ index, item }) => ({
      index,
      title: item.title,
      description: item.description.substring(0, 150),
    }))

    try {
      const results = model === 'gemini'
        ? await classifyWithGemini(itemsForAI)
        : await classifyWithClaude(itemsForAI)

      // Store new classifications in cache
      for (const { index, item } of needsClassification) {
        const result = results.get(index)
        if (result) {
          classificationCache.set(item.link, {
            isInteresting: result.interesting,
            category: result.category as ClassificationResult['category'],
            isSpoiler: result.spoiler,
            classifiedAt: Date.now(),
          })
        } else {
          // Default if AI didn't return result for this item
          classificationCache.set(item.link, {
            isInteresting: true,
            category: 'other',
            isSpoiler: false,
            classifiedAt: Date.now(),
          })
        }
      }
    } catch (error) {
      console.error('AI classification error:', error)
      // On error, mark new items as interesting and not spoilers
      for (const { item } of needsClassification) {
        classificationCache.set(item.link, {
          isInteresting: true,
          category: 'other',
          isSpoiler: false,
          classifiedAt: Date.now(),
        })
      }
    }
  } else {
    console.log(`All ${items.length} articles found in cache, no AI needed`)
  }

  // Fetch article metadata (OG images + dates) for all items (use cache)
  const articleMeta = await Promise.all(
    items.map(async (item, index) => {
      // Check cache first
      if (articleMetaCache.has(item.link)) {
        return { index, ...articleMetaCache.get(item.link)! }
      }
      // Only fetch if we need image or date
      if (!item.imageUrl || !item.pubDate) {
        const meta = await fetchArticleMeta(item.link)
        articleMetaCache.set(item.link, meta)
        return { index, ...meta }
      }
      return { index, imageUrl: null, publishDate: null }
    })
  )
  const metaMap = new Map(articleMeta.map(m => [m.index, m]))

  // Build final response using cache
  return items.map((item, i) => {
    const classification = classificationCache.get(item.link)
    const meta = metaMap.get(i)
    return {
      id: `f1-news-${i}-${Date.now()}`,
      title: item.title,
      description: item.description,
      link: item.link,
      pubDate: item.pubDate || meta?.publishDate || '',
      imageUrl: item.imageUrl || meta?.imageUrl || undefined,
      isInteresting: classification?.isInteresting ?? true,
      isSpoiler: classification?.isSpoiler ?? false,
      category: classification?.category ?? 'other',
    }
  })
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const model = (searchParams.get('model') || 'claude') as 'claude' | 'gemini'
  const forceRefresh = searchParams.get('refresh') === 'true'
  const forceReclassify = searchParams.get('reclassify') === 'true'

  // Clear caches if reclassify requested
  if (forceReclassify) {
    classificationCache.clear()
    articleMetaCache.clear()
    responseCache = null
    console.log('All caches cleared - will re-classify and re-fetch all articles')
  }

  // Check response cache (just to avoid hammering RSS feed)
  if (!forceRefresh && !forceReclassify && responseCache && Date.now() - responseCache.timestamp < RESPONSE_CACHE_DURATION) {
    return NextResponse.json({
      items: responseCache.items,
      cached: true,
      timestamp: responseCache.timestamp,
      cacheStats: {
        totalClassified: classificationCache.size,
        responseAge: Math.round((Date.now() - responseCache.timestamp) / 1000),
      },
    })
  }

  try {
    // Fetch F1 RSS feed
    const rssUrl = 'https://www.formula1.com/en/latest/all.xml'
    const response = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Family-Hub/1.0' },
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status}`)
    }

    const xml = await response.text()
    const rssItems = parseRSS(xml)

    // Get classifications (uses persistent cache, only classifies new articles)
    const newsItems = await getClassifications(rssItems, model)

    // Update response cache
    responseCache = {
      items: newsItems,
      timestamp: Date.now(),
    }

    return NextResponse.json({
      items: newsItems,
      cached: false,
      timestamp: Date.now(),
      cacheStats: {
        totalClassified: classificationCache.size,
      },
    })
  } catch (error) {
    console.error('F1 news fetch error:', error)

    if (responseCache) {
      return NextResponse.json({
        items: responseCache.items,
        cached: true,
        stale: true,
        timestamp: responseCache.timestamp,
      })
    }

    return NextResponse.json(
      { error: 'Failed to fetch F1 news', items: [] },
      { status: 500 }
    )
  }
}
