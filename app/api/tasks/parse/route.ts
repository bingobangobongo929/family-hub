import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Types for AI response
interface ParsedTask {
  title: string
  description?: string
  assignee_name?: string // Name to match against family members
  due_date?: string // YYYY-MM-DD
  due_time?: string // HH:MM
  due_context?: string // e.g., "at work", "before dinner", "this weekend"
  urgency: 'low' | 'normal' | 'high' | 'urgent'
  suggested_category?: string
  is_recurring?: boolean
  recurrence_pattern?: string
}

interface AIResponse {
  tasks: ParsedTask[]
  summary: string
  raw_text?: string
  confidence: number
}

// Valid Gemini model IDs
const VALID_GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-3-flash-preview'
] as const
type GeminiModelId = typeof VALID_GEMINI_MODELS[number]
const DEFAULT_MODEL: GeminiModelId = 'gemini-2.5-flash'

// Default task categories
const DEFAULT_CATEGORIES = [
  'Work', 'Admin', 'Finance', 'Health', 'Home', 'Shopping', 'Kids', 'Personal', 'Errands', 'Other'
]

// Gemini API call for task parsing
async function parseTaskWithGemini(
  text: string,
  context?: string,
  modelId: GeminiModelId = DEFAULT_MODEL
): Promise<AIResponse> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) {
    throw new Error('Google AI API key not configured')
  }

  const now = new Date()
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' })
  const isWeekday = now.getDay() >= 1 && now.getDay() <= 5

  const prompt = `You are a helpful assistant that extracts tasks from natural language messages.
Today is ${dayOfWeek}, ${now.toISOString().split('T')[0]}.
Current time is approximately ${now.toTimeString().split(' ')[0]}.
${isWeekday ? 'Today is a weekday (work day).' : 'Today is a weekend.'}

When extracting tasks:
1. Parse dates and times accurately, inferring reasonable values when not explicitly stated
2. Use 24-hour format for times (HH:MM)
3. Use ISO format for dates (YYYY-MM-DD)
4. For relative dates like "tomorrow", "next week", "by Friday", calculate the actual date
5. Detect WHO the task is for based on phrases like:
   - "For me:" → the speaker
   - "For [Name]:" → that specific person
   - "I need to" → the speaker
   - "Can you" → the recipient
   - "We need to" → could be shared/unclear
6. Detect URGENCY based on:
   - Words like "urgent", "ASAP", "immediately" → urgent
   - Words like "important", "priority", "must" → high
   - Explicit deadlines like "by tomorrow" → high
   - Normal tasks → normal
   - Words like "when you can", "no rush", "eventually" → low
7. Detect CONTEXT that affects reminders:
   - "while at work" → work context (remind at work times)
   - "this weekend" → weekend context
   - "before dinner" → evening context
   - "in the morning" → morning context
8. Suggest an appropriate category from: ${DEFAULT_CATEGORIES.join(', ')}

EXAMPLES:
- "Look at 2025 tax and add servicefradrag from the windows on my form, I have till tomorrow"
  → title: "Review 2025 tax form - add servicefradrag for windows"
  → due_date: [tomorrow's date]
  → urgency: "high" (deadline tomorrow)
  → suggested_category: "Finance"
  → due_context: "at work" (if sent on weekday)

- "For Ed: Pick up dry cleaning on your way home"
  → title: "Pick up dry cleaning"
  → assignee_name: "Ed"
  → urgency: "normal"
  → suggested_category: "Errands"
  → due_context: "on way home"

- "Remember to call the dentist about Olivia's appointment"
  → title: "Call dentist about Olivia's appointment"
  → urgency: "normal"
  → suggested_category: "Health"

${context ? `Family context:\n${context}` : ''}

Input to process:
${text}

Return ONLY valid JSON with this structure (no markdown, no extra text):
{
  "tasks": [
    {
      "title": "Clear, actionable task title",
      "description": "Additional details if any",
      "assignee_name": "Name of person responsible (or null)",
      "due_date": "YYYY-MM-DD (or null)",
      "due_time": "HH:MM (or null)",
      "due_context": "Context hint for reminders (or null)",
      "urgency": "low|normal|high|urgent",
      "suggested_category": "Category name from list",
      "is_recurring": false,
      "recurrence_pattern": null
    }
  ],
  "summary": "Brief summary of what was extracted",
  "confidence": 0.95
}

Note: confidence should be 0.0 to 1.0 based on how clear the task extraction was.
If the message doesn't seem to contain a task, return empty tasks array with confidence 0.`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
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
    throw new Error(`Gemini API error: ${response.status}`)
  }

  const data = await response.json()

  if (data.candidates?.[0]?.finishReason === 'SAFETY') {
    throw new Error('Response blocked by safety filters')
  }

  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!textContent) {
    console.error('No text content in Gemini response:', data)
    throw new Error('No response from Gemini')
  }

  try {
    let cleaned = textContent
    cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/g, '')
    cleaned = cleaned.trim()

    const parsed = JSON.parse(cleaned)
    return {
      tasks: parsed.tasks || [],
      summary: parsed.summary || 'Tasks extracted',
      raw_text: textContent,
      confidence: parsed.confidence || 0.5,
    }
  } catch (parseError) {
    console.error('JSON parse error:', parseError)
    console.error('Raw text was:', textContent)
    return {
      tasks: [],
      summary: 'Could not parse AI response',
      raw_text: textContent,
      confidence: 0,
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Authenticate user
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { text, model = DEFAULT_MODEL } = body

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Please provide text to parse' },
        { status: 400 }
      )
    }

    // Get family context for better AI parsing
    let context = ''

    // Get family members
    const { data: members } = await supabase
      .from('family_members')
      .select('name, role')
      .eq('user_id', user.id)

    if (members && members.length > 0) {
      context += 'Family members:\n'
      members.forEach(m => {
        context += `- ${m.name} (${m.role})\n`
      })
    }

    // Get existing categories
    const { data: categories } = await supabase
      .from('task_categories')
      .select('name')
      .eq('user_id', user.id)

    if (categories && categories.length > 0) {
      context += '\nExisting task categories:\n'
      categories.forEach(c => {
        context += `- ${c.name}\n`
      })
    }

    // Validate model ID
    const modelId: GeminiModelId = VALID_GEMINI_MODELS.includes(model as GeminiModelId)
      ? (model as GeminiModelId)
      : DEFAULT_MODEL

    const result = await parseTaskWithGemini(text, context, modelId)

    // Match assignee names to family member IDs
    const tasksWithIds = result.tasks.map(task => {
      let assignee_id = null
      if (task.assignee_name && members) {
        const match = members.find(m =>
          m.name.toLowerCase() === task.assignee_name?.toLowerCase()
        )
        if (match) {
          assignee_id = match
        }
      }
      return {
        ...task,
        assignee_match: assignee_id,
      }
    })

    return NextResponse.json({
      ...result,
      tasks: tasksWithIds,
    })
  } catch (error) {
    console.error('Task parse error:', error)
    return NextResponse.json(
      { error: 'Failed to parse task' },
      { status: 500 }
    )
  }
}
