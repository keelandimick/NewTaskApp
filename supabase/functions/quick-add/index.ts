import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { OpenAI } from 'https://deno.land/x/openai@v4.20.1/mod.ts'
import * as chrono from 'npm:chrono-node@2.7.6'

// Create custom Chrono instance with future-only times (matching chronoConfig.ts)
const customChrono = chrono.casual.clone()
customChrono.refiners.push({
  refine: (context: any, results: any) => {
    results.forEach((result: any) => {
      const components = result.start

      // If we have an hour but no meridiem (AM/PM) specified
      if (components.get('hour') !== null && !components.isCertain('meridiem')) {
        const hour = components.get('hour')

        if (hour === null) return

        // Smart PM defaults (matching chronoConfig.ts)
        if (hour >= 8 && hour <= 11) {
          const refDate = result.refDate || new Date()
          const currentHour = refDate.getHours()

          if (currentHour >= hour) {
            components.assign('meridiem', 1) // PM
            components.assign('hour', hour + 12 === 24 ? 12 : hour + 12)
          } else {
            components.assign('meridiem', 0) // AM
          }
        } else if (hour >= 1 && hour <= 7) {
          // 1-7 are always PM
          components.assign('meridiem', 1)
          components.assign('hour', hour + 12)
        } else if (hour === 12) {
          // 12 is PM (noon)
          components.assign('meridiem', 1)
        }
      }

      // Ensure times are always in the future
      const resultDate = result.date()
      const now = new Date()

      // If the parsed time is in the past and it's today, move it to tomorrow
      if (resultDate < now &&
          resultDate.toDateString() === now.toDateString() &&
          components.get('day') === null) {
        const tomorrow = new Date(resultDate)
        tomorrow.setDate(tomorrow.getDate() + 1)

        components.assign('day', tomorrow.getDate())
        components.assign('month', tomorrow.getMonth() + 1)
        components.assign('year', tomorrow.getFullYear())
      }
    })

    return results
  }
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',  // Allow all headers - security is via token validation
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Verify the user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      throw new Error('Invalid authorization token')
    }

    // Parse request body
    const { text, reminder_date } = await req.json()
    if (!text || typeof text !== 'string') {
      throw new Error('Missing or invalid "text" field')
    }

    console.log(`Processing quick-add for user ${user.id}: "${text}"${reminder_date ? ` with date: ${reminder_date}` : ''}`)

    // Initialize OpenAI
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured')
    }
    const openai = new OpenAI({ apiKey: openaiKey })

    // Get user's lists (using service role, bypasses RLS)
    const { data: lists, error: listsError } = await supabase
      .from('lists')
      .select('id, name')
      .eq('user_id', user.id)
      .order('name')

    if (listsError) {
      console.error('Error fetching lists:', listsError)
      // Don't throw error if no lists, just continue with empty array
    }

    // Process text with AI for spell correction, list matching, and priority
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that processes task titles. You must:
1. Fix spelling mistakes
2. Capitalize ONLY the first letter and proper nouns (names, places)
3. Do NOT capitalize common words like: with, to, from, at, in, on, for, and, the, a, an
4. NEVER change URLs, domains, or email addresses - keep them exactly as typed
5. Match the task to the most appropriate list based on content and keywords
6. Determine priority based on urgency indicators:
   - "now" for: urgent, ASAP, immediately, today, critical, emergency, important, !!!, ***
   - "high" for: soon, tomorrow, this week, priority, deadline, !, **, HIGH
   - "low" for: everything else (default)

Return ONLY a JSON object in this exact format:
{"correctedText": "corrected task text", "listId": "matching-list-id", "priority": "now|high|low"}

NEVER add punctuation. Return ONLY the JSON object, nothing else.`
        },
        {
          role: "user",
          content: lists && lists.length > 0
            ? `Task: "${text}"\n\nAvailable lists:\n${lists.map(l => `- ${l.name} (id: ${l.id})`).join('\n')}\n\nProcess this task and return the JSON.`
            : `Task: "${text}"\n\nNo lists available. Process the task and return JSON with correctedText and priority only.`
        }
      ],
      temperature: 0.3,
      max_tokens: 200
    })

    let aiContent = aiResponse.choices[0]?.message?.content || '{}'
    aiContent = aiContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const parsed = JSON.parse(aiContent)

    let correctedText = parsed.correctedText || text
    let listId = parsed.listId
    const priority = parsed.priority || 'low'

    // Verify list ID exists, otherwise use first list or create default
    if (!listId || !lists?.find(l => l.id === listId)) {
      if (lists && lists.length > 0) {
        listId = lists[0].id
      } else {
        // Create default list if none exist
        const { data: newList, error: createError } = await supabase
          .from('lists')
          .insert({ name: 'Personal', color: '#3B82F6', userId: user.id })
          .select()
          .single()

        if (createError) throw createError
        listId = newList.id
      }
    }

    // Helper function to expand number words (two → 2, three → 3, etc.)
    const expandNumberWords = (text: string): string => {
      const numberWords: Record<string, string> = {
        'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
        'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
        'eleven': '11', 'twelve': '12'
      }
      let result = text
      Object.entries(numberWords).forEach(([word, number]) => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi')
        result = result.replace(regex, number)
      })
      return result
    }

    // Extract date and recurring patterns from title (matching web version exactly)
    let extractedTitle = correctedText
    let extractedDate: Date | null = null
    let detectedRecurrence: { frequency: string; time: string; interval?: number; originalText?: string } | null = null

    // If Siri/iOS provided a date, use it directly (takes priority over detection)
    if (reminder_date) {
      extractedDate = new Date(reminder_date)

      // Still strip time patterns from the title (e.g., "at 5pm")
      const timePattern = /\b(at\s+)?(\d{1,2})(:\d{2})?\s*([ap]m?|AM|PM)?\b/i
      extractedTitle = correctedText.replace(timePattern, '').trim()
      if (extractedTitle.length > 0) {
        extractedTitle = extractedTitle.charAt(0).toUpperCase() + extractedTitle.slice(1)
      }
    } else {
      // Expand spelled-out numbers for better matching
      const expandedText = expandNumberWords(correctedText)
      // Use expanded text for all pattern matching and replacement
      correctedText = expandedText

      // Check for recurring patterns first (matching web TaskModal.tsx lines 85-136)
      const recurringPatterns = [
        { pattern: /\bevery\s+\d+\s+minutes?\b/i, frequency: 'daily' }, // "every 2 minutes" -> daily (treat as minutely internally)
        { pattern: /\bevery\s+\d+\s+hours?\b/i, frequency: 'daily' }, // "every 3 hours" -> daily (treat as hourly internally)
        { pattern: /\b(every\s+day|daily)\b/i, frequency: 'daily' },
        { pattern: /\b(every\s+week|weekly)\b/i, frequency: 'weekly' },
        { pattern: /\b(every\s+month|monthly)\b/i, frequency: 'monthly' },
        { pattern: /\b(every\s+year|yearly|annually)\b/i, frequency: 'yearly' },
        { pattern: /\bevery\s+(mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?)\b/i, frequency: 'weekly' },
        { pattern: /\bevery\s+(other|2nd|second)\s+(mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?)\b/i, frequency: 'weekly' },
        { pattern: /\b(weekdays|every\s+weekday)\b/i, frequency: 'daily' },
        { pattern: /\b(weekends|every\s+weekend)\b/i, frequency: 'weekly' }
      ]

      for (const { pattern, frequency } of recurringPatterns) {
        const match = correctedText.match(pattern)
        if (match) {
          // Determine if it's minutely or hourly (for "every X minutes/hours" pattern)
          const isMinutely = match[0].toLowerCase().includes('minute')
          const isHourly = match[0].toLowerCase().includes('hour')
          let interval = 1

          if (isMinutely) {
            const intervalMatch = match[0].match(/every\s+(\d+)\s+minutes?/)
            if (intervalMatch) {
              interval = parseInt(intervalMatch[1], 10)
            }
          } else if (isHourly) {
            const intervalMatch = match[0].match(/every\s+(\d+)\s+hours?/)
            if (intervalMatch) {
              interval = parseInt(intervalMatch[1], 10)
            }
          }

          detectedRecurrence = {
            frequency: isMinutely ? 'minutely' : (isHourly ? 'hourly' : frequency),
            time: '09:00',
            interval: (isMinutely || isHourly) ? interval : undefined,
            originalText: match[0]
          }

          // Strip recurring pattern from title
          extractedTitle = correctedText.replace(match[0], '').trim()
          if (extractedTitle.length > 0) {
            extractedTitle = extractedTitle.charAt(0).toUpperCase() + extractedTitle.slice(1)
          }

          // Try to parse time from the title
          const timeMatch = correctedText.match(/\b(at\s+)?(\d{1,2})(:\d{2})?\s*(am|pm|AM|PM)?\b/i)
          if (timeMatch && timeMatch[2] && detectedRecurrence) {
            let hours = parseInt(timeMatch[2], 10)
            const minutes = timeMatch[3] ? parseInt(timeMatch[3].slice(1), 10) : 0

            if (timeMatch[4]) {
              const isPM = timeMatch[4].toLowerCase() === 'pm'
              if (isPM && hours !== 12) hours += 12
              if (!isPM && hours === 12) hours = 0
            } else if (hours >= 1 && hours <= 11) {
              hours += 12 // Default to PM
            }

            detectedRecurrence.time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`

            // Strip time from title
            extractedTitle = extractedTitle.replace(timeMatch[0], '').trim()
            if (extractedTitle.length > 0) {
              extractedTitle = extractedTitle.charAt(0).toUpperCase() + extractedTitle.slice(1)
            }
          }

          break
        }
      }

      // If no recurring pattern, try to extract a single date using Chrono
      if (!detectedRecurrence) {
        // Use correctedText (already expanded) for Chrono
        const parsedFromTitle = customChrono.parse(correctedText.trim())
        if (parsedFromTitle.length > 0) {
          extractedDate = parsedFromTitle[0].start.date()
          // Remove the date text from the title
          extractedTitle = correctedText.replace(parsedFromTitle[0].text, '').trim()

          // Also strip standalone time patterns (like "at 5pm") that Chrono might have missed
          const timePattern = /\b(at\s+)?(\d{1,2})(:\d{2})?\s*([ap]m?|AM|PM)?\b/i
          extractedTitle = extractedTitle.replace(timePattern, '').trim()

          // Re-capitalize after removing date/time text
          if (extractedTitle.length > 0) {
            extractedTitle = extractedTitle.charAt(0).toUpperCase() + extractedTitle.slice(1)
          }
        }
      }
    }

    // Now correctedText becomes the cleaned title (with dates/recurrence stripped)
    // This cleaned title will be sent to AI for spell correction and list matching
    correctedText = extractedTitle

    // Determine item type and status
    let type: 'task' | 'reminder' = 'task'
    let status = 'start'
    let reminderDate = null
    let recurrence = null

    const hasDate = extractedDate || detectedRecurrence

    if (hasDate) {
      type = 'reminder'

      if (detectedRecurrence) {
        // Recurring reminder
        status = 'within7' // Database requires today/within7/7plus

        const now = new Date()
        let time: string

        if (detectedRecurrence.frequency === 'minutely') {
          // For minutely: start from current time + interval
          const nextOccurrence = new Date(now.getTime() + (detectedRecurrence.interval || 1) * 60 * 1000)
          time = nextOccurrence.toTimeString().slice(0, 5)
          reminderDate = nextOccurrence.toISOString()
        } else if (detectedRecurrence.frequency === 'hourly') {
          // For hourly: start from current time + interval
          const nextOccurrence = new Date(now.getTime() + (detectedRecurrence.interval || 1) * 60 * 60 * 1000)
          time = nextOccurrence.toTimeString().slice(0, 5)
          reminderDate = nextOccurrence.toISOString()
        } else {
          time = detectedRecurrence.time
        }

        recurrence = {
          frequency: detectedRecurrence.frequency,
          time,
          interval: detectedRecurrence.interval,
          originalText: detectedRecurrence.originalText
        }
      } else if (extractedDate) {
        // Single date reminder
        reminderDate = extractedDate.toISOString()

        const now = new Date()
        const diffDays = Math.ceil((extractedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        if (diffDays <= 1) {
          status = 'today'
        } else if (diffDays <= 7) {
          status = 'within7'
        } else {
          status = '7plus'
        }
      }
    }

    // Create the item (using snake_case for database columns)
    const itemData: any = {
      type,
      title: correctedText,
      priority,
      status,
      list_id: listId,
      user_id: user.id
    }

    if (reminderDate) {
      itemData.reminder_date = reminderDate
    }

    if (recurrence) {
      itemData.recurrence = recurrence
    }

    const { data: newItem, error: insertError } = await supabase
      .from('items')
      .insert(itemData)
      .select()
      .single()

    if (insertError) {
      console.error('Error creating item:', insertError)
      console.error('Item data that failed:', JSON.stringify(itemData, null, 2))
      throw new Error(`Failed to create item: ${insertError.message || JSON.stringify(insertError)}`)
    }

    console.log(`Successfully created item: ${newItem.id}`)

    return new Response(
      JSON.stringify({
        success: true,
        item: newItem  // Return complete item with all fields
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in quick-add function:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message || 'An error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
