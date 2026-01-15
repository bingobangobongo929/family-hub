import { NextRequest, NextResponse } from 'next/server'

// Types for AI response
interface ExtractedEvent {
  title: string
  description?: string
  start_date: string // YYYY-MM-DD
  start_time?: string // HH:MM
  end_date?: string
  end_time?: string
  all_day: boolean
  location?: string
  suggested_member?: string // Name to match against family members (deprecated)
  suggested_members?: string[] // Multiple family member names
  suggested_category?: string // Category name to match
  suggested_contacts?: string[] // Extended contacts (grandparents, friends, etc.)
  recurrence_pattern?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
    interval?: number // Every X days/weeks/months/years (default 1)
    days_of_week?: string[] // For weekly: ["monday", "wednesday"]
    day_of_month?: number // For monthly: 1-31
    until?: string // End date YYYY-MM-DD (optional)
    count?: number // Number of occurrences (optional)
  }
}

interface AIResponse {
  events: ExtractedEvent[]
  summary: string
  raw_text?: string
}

// Valid Gemini model IDs - DO NOT CHANGE THESE
const VALID_GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-3-flash-preview'
] as const
type GeminiModelId = typeof VALID_GEMINI_MODELS[number]
const DEFAULT_MODEL: GeminiModelId = 'gemini-3-flash-preview'

// Available categories for AI to suggest
const CATEGORY_NAMES = [
  'Doctors/Hospital', 'Guest Daycare', 'Car Service', 'Birthday', 'School',
  'Activities/Lessons', 'Playdates', 'Family Gathering', 'Holiday/Vacation',
  'Work', 'Pet', 'Home Maintenance', 'Reminder', 'Misc'
]

// Gemini API call
async function processWithGemini(
  text: string,
  image?: string,
  context?: string,
  modelId: GeminiModelId = DEFAULT_MODEL
): Promise<AIResponse> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) {
    throw new Error('Google AI API key not configured')
  }

  const prompt = `You are a helpful assistant that extracts calendar events from text and images.
Today's date is ${new Date().toISOString().split('T')[0]}.

When extracting events:
1. Parse dates and times accurately, inferring reasonable values when not explicitly stated
2. Use 24-hour format for times (HH:MM)
3. Use ISO format for dates (YYYY-MM-DD)
4. For relative dates like "tomorrow" or "next Tuesday", calculate the actual date
5. Detect RECURRING PATTERNS - phrases like "every Tuesday", "weekly swimming", "monthly checkup" indicate recurrence
6. Extract location if mentioned
7. Identify TWO types of people:
   - Board family members (core family) - put in suggested_members
   - Extended contacts (grandparents, friends, relatives) - put in suggested_contacts
8. Suggest an appropriate category from this list: ${CATEGORY_NAMES.join(', ')}

RECURRENCE PATTERNS to detect:
- "every Tuesday" → weekly on tuesday
- "weekly swimming" → weekly
- "every other Wednesday" → weekly, interval 2
- "monthly checkup on the 15th" → monthly, day_of_month 15
- "daily standup" → daily
- "every Monday and Thursday" → weekly, days_of_week: ["monday", "thursday"]

PEOPLE DETECTION examples:
- "Grandma picking up Olivia" → suggested_members: ["Olivia"], suggested_contacts: ["Grandma"]
- "Playdate at Emma's house" → suggested_contacts: ["Emma"]
- "Mormor babysitting" → suggested_contacts: ["Mormor"]

IMPORTANT - Display Names:
When a contact has an alias (shown as "also known as"), ALWAYS use that alias in the event title instead of their real name.
Example: If "Hannah (also known as Mormor)" is in the contacts, and user says "Dinner with Hannah", the title should be "Dinner with Mormor".

${context ? `Family context:\n${context}` : ''}

Input to process:
${text || 'Please extract calendar events from the provided image.'}

Return ONLY valid JSON with this structure (no markdown, no extra text):
{
  "events": [
    {
      "title": "Event name",
      "description": "Optional details",
      "start_date": "YYYY-MM-DD",
      "start_time": "HH:MM",
      "end_date": "YYYY-MM-DD",
      "end_time": "HH:MM",
      "all_day": false,
      "location": "Optional location",
      "suggested_members": ["FamilyMember1"],
      "suggested_contacts": ["Grandma"],
      "suggested_category": "Category name from list",
      "recurrence_pattern": {
        "frequency": "weekly",
        "interval": 1,
        "days_of_week": ["tuesday"],
        "until": "2025-12-31"
      }
    }
  ],
  "summary": "Brief summary of what was extracted"
}

Note: recurrence_pattern is optional - only include if the event repeats.`

  const parts: any[] = [{ text: prompt }]

  // Add image if provided
  if (image) {
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')
    const mimeType = image.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'
    parts.unshift({
      inline_data: {
        mime_type: mimeType,
        data: base64Data,
      },
    })
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error('Gemini API error:', error)
    throw new Error(`Gemini API error: ${response.status}`)
  }

  const data = await response.json()
  console.log('Gemini raw response:', JSON.stringify(data, null, 2))

  // Check for blocked or empty responses
  if (data.candidates?.[0]?.finishReason === 'SAFETY') {
    throw new Error('Response blocked by safety filters')
  }

  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!textContent) {
    console.error('No text content in Gemini response:', data)
    throw new Error('No response from Gemini - check API key and model')
  }

  console.log('Gemini text content:', textContent)

  try {
    // Clean up potential markdown formatting (```json ... ```)
    let cleaned = textContent
    // Remove markdown code blocks
    cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/g, '')
    // Remove any leading/trailing whitespace
    cleaned = cleaned.trim()

    console.log('Cleaned JSON:', cleaned)

    const parsed = JSON.parse(cleaned)
    return {
      events: parsed.events || [],
      summary: parsed.summary || 'Events extracted',
      raw_text: textContent,
    }
  } catch (parseError) {
    console.error('JSON parse error:', parseError)
    console.error('Raw text was:', textContent)
    return {
      events: [],
      summary: 'Could not parse AI response',
      raw_text: textContent,
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, image, model = DEFAULT_MODEL, context } = body

    if (!text && !image) {
      return NextResponse.json(
        { error: 'Please provide text or an image to process' },
        { status: 400 }
      )
    }

    // Validate model ID, fallback to default if invalid
    const modelId: GeminiModelId = VALID_GEMINI_MODELS.includes(model as GeminiModelId)
      ? (model as GeminiModelId)
      : DEFAULT_MODEL

    const result = await processWithGemini(text, image, context, modelId)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Calendar AI error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    )
  }
}
