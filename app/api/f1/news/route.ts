import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
}

interface DBArticle {
  id: string
  link: string
  title: string
  description: string | null
  image_url: string | null
  pub_date: string | null
  is_interesting: boolean
  is_spoiler: boolean
  category: string
}

// Model identifiers - DO NOT CHANGE THESE MODEL NAMES
// gemini-3-flash-preview is the CORRECT model name (verified by user)
const CLAUDE_MODEL = 'claude-sonnet-4-5-20250514'
const GEMINI_MODEL = 'gemini-3-flash-preview'

// Supabase client (use service role for writes)
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Simple XML parser for RSS
function parseRSSItem(itemXml: string): RSSItem | null {
  const getTag = (xml: string, tag: string): string => {
    const cdataMatch = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i'))
    if (cdataMatch) return cdataMatch[1].trim()
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
    return match ? match[1].trim() : ''
  }

  const title = getTag(itemXml, 'title')
  const description = getTag(itemXml, 'description')
  const link = getTag(itemXml, 'link')

  if (!title || !link) return null

  return {
    title,
    description: description.replace(/<[^>]*>/g, '').substring(0, 500),
    link,
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

    // Try to extract publish date
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

NOT SPOILERS:
- Pre-race previews, predictions
- Driver/team news not about results
- Technical analysis without result info
- Calendar/schedule changes
- General F1 news

Return JSON: {"results": [{"index": 0, "interesting": true, "category": "race", "spoiler": true}, ...]}

Articles:`

// Classify articles with Claude
async function classifyWithClaude(items: { index: number, title: string, description: string }[]): Promise<Map<number, { interesting: boolean, category: string, spoiler: boolean }>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('No Anthropic API key')

  console.log(`Classifying ${items.length} articles with Claude...`)

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
        content: `${FILTER_PROMPT}\n${JSON.stringify(items, null, 2)}\n\nIMPORTANT: Respond with ONLY the JSON object, no markdown, no explanation. Start your response with { and end with }`,
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
  console.log('Claude raw response:', content.substring(0, 500))

  const resultMap = new Map<number, { interesting: boolean, category: string, spoiler: boolean }>()

  // Try to extract JSON - handle markdown code blocks
  let jsonStr = content.trim()
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim()
  }

  try {
    const parsed = JSON.parse(jsonStr)
    const results = parsed.results || []
    console.log(`Parsed ${results.length} classification results`)
    for (const r of results) {
      console.log(`Article ${r.index}: category=${r.category}, interesting=${r.interesting}, spoiler=${r.spoiler}`)
      resultMap.set(r.index, {
        interesting: r.interesting ?? false,
        category: r.category || 'other',
        spoiler: r.spoiler ?? false
      })
    }
  } catch (parseError) {
    console.error('Initial JSON parse failed:', parseError)
    // Try to find JSON object in response
    const jsonMatch = jsonStr.match(/\{[\s\S]*"results"[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        const results = parsed.results || []
        console.log(`Fallback parsed ${results.length} classification results`)
        for (const r of results) {
          resultMap.set(r.index, {
            interesting: r.interesting ?? false,
            category: r.category || 'other',
            spoiler: r.spoiler ?? false
          })
        }
      } catch (e) {
        console.error('Fallback JSON parse error:', e)
        console.error('Attempted to parse:', jsonMatch[0].substring(0, 300))
      }
    } else {
      console.error('No JSON object found in response')
    }
  }

  console.log(`Returning ${resultMap.size} classifications`)
  return resultMap
}

// Classify articles with Gemini
async function classifyWithGemini(items: { index: number, title: string, description: string }[]): Promise<Map<number, { interesting: boolean, category: string, spoiler: boolean }>> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('No Google AI API key')

  console.log(`Classifying ${items.length} articles with Gemini...`)

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
          temperature: 0,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
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
  const finishReason = data.candidates?.[0]?.finishReason
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
  console.log('Gemini finish reason:', finishReason)
  console.log('Gemini response length:', content.length)
  if (finishReason !== 'STOP') {
    console.error('Gemini response may be incomplete! Finish reason:', finishReason)
  }

  const resultMap = new Map<number, { interesting: boolean, category: string, spoiler: boolean }>()

  try {
    const parsed = JSON.parse(content)
    const results = parsed.results || []
    console.log(`Parsed ${results.length} classification results from Gemini`)
    for (const r of results) {
      resultMap.set(r.index, {
        interesting: r.interesting ?? false,
        category: r.category || 'other',
        spoiler: r.spoiler ?? false
      })
    }
  } catch (parseError) {
    console.error('Gemini JSON parse failed:', parseError)
    console.error('Raw content:', content.substring(0, 500))
  }

  console.log(`Returning ${resultMap.size} Gemini classifications`)
  return resultMap
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const model = (searchParams.get('model') || 'claude') as 'claude' | 'gemini'
  const forceReclassify = searchParams.get('reclassify') === 'true'

  const supabase = getSupabase()

  try {
    // If reclassify, clear database
    if (forceReclassify) {
      await supabase.from('f1_news_articles').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      console.log('Database cleared - will re-classify all articles')
    }

    // Get existing articles from database
    const { data: existingArticles } = await supabase
      .from('f1_news_articles')
      .select('*')
      .order('pub_date', { ascending: false, nullsFirst: false })

    const existingLinks = new Set((existingArticles || []).map((a: DBArticle) => a.link))

    // Fetch RSS feed
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

    // Find new articles not in database
    const newItems = rssItems.filter(item => !existingLinks.has(item.link))

    console.log(`Found ${rssItems.length} articles in RSS, ${newItems.length} are new`)

    // Process new articles
    if (newItems.length > 0) {
      // Fetch metadata (images + dates) for new articles
      const metaResults = await Promise.all(
        newItems.map(async (item) => {
          const meta = await fetchArticleMeta(item.link)
          return { ...item, ...meta }
        })
      )

      // Classify new articles with AI
      const itemsForAI = newItems.map((item, index) => ({
        index,
        title: item.title,
        description: item.description.substring(0, 150),
      }))

      let classifications = new Map<number, { interesting: boolean, category: string, spoiler: boolean }>()

      try {
        classifications = model === 'gemini'
          ? await classifyWithGemini(itemsForAI)
          : await classifyWithClaude(itemsForAI)
        console.log(`Classified ${classifications.size} articles with ${model}`)
      } catch (error) {
        console.error('AI classification error:', error)
      }

      // If classification failed, use defaults
      if (classifications.size === 0) {
        console.log('Classification failed, using defaults')
        newItems.forEach((_, i) => {
          classifications.set(i, { interesting: true, category: 'other', spoiler: false })
        })
      }

      // Insert new articles into database
      const articlesToInsert = metaResults.map((item, i) => {
        const classification = classifications.get(i)
        return {
          link: item.link,
          title: item.title,
          description: item.description,
          image_url: item.imageUrl,
          pub_date: item.publishDate || null,
          is_interesting: classification?.interesting ?? true,
          is_spoiler: classification?.spoiler ?? false,
          category: classification?.category || 'other',
        }
      })

      const { error: insertError } = await supabase
        .from('f1_news_articles')
        .insert(articlesToInsert)

      if (insertError) {
        console.error('Error inserting articles:', insertError)
      } else {
        console.log(`Inserted ${articlesToInsert.length} new articles`)
      }
    }

    // Fetch all articles from database (now includes new ones)
    const { data: allArticles, error: fetchError } = await supabase
      .from('f1_news_articles')
      .select('*')
      .order('pub_date', { ascending: false, nullsFirst: false })
      .limit(20)

    if (fetchError) {
      throw fetchError
    }

    // Convert to response format
    const items: F1NewsItem[] = (allArticles || []).map((article: DBArticle) => ({
      id: article.id,
      title: article.title,
      description: article.description || '',
      link: article.link,
      pubDate: article.pub_date || '',
      imageUrl: article.image_url || undefined,
      isInteresting: article.is_interesting,
      isSpoiler: article.is_spoiler,
      category: article.category as F1NewsItem['category'],
    }))

    return NextResponse.json({
      items,
      newArticles: newItems.length,
      totalInDb: existingArticles?.length || 0,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('F1 news fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch F1 news', items: [] },
      { status: 500 }
    )
  }
}
