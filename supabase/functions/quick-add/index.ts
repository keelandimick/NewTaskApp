import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { OpenAI } from 'https://deno.land/x/openai@v4.20.1/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const { text } = await req.json()
    if (!text || typeof text !== 'string') {
      throw new Error('Missing or invalid "text" field')
    }

    console.log(`Processing quick-add for user ${user.id}: "${text}"`)

    // Initialize OpenAI
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured')
    }
    const openai = new OpenAI({ apiKey: openaiKey })

    // Get user's lists
    const { data: lists, error: listsError } = await supabase
      .from('lists')
      .select('id, name')
      .or(`userId.eq.${user.id},sharedWith.cs.{${user.email}}`)
      .order('name')

    if (listsError) {
      console.error('Error fetching lists:', listsError)
      throw new Error('Failed to fetch lists')
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

    const correctedText = parsed.correctedText || text
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

    // Check for dates and recurrence patterns
    let type: 'task' | 'reminder' = 'task'
    let status = 'start'
    let reminderDate = null
    let recurrence = null

    // Check for recurring patterns
    const recurringMatch = correctedText.match(/\b(every\s+(other\s+)?\d*\s*(day|week|month|year|hours?|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|daily|weekly|monthly|yearly|annually|weekdays?|weekends?)\b/i)

    if (recurringMatch) {
      type = 'reminder'
      const frequency = recurringMatch[0].toLowerCase().includes('day') ? 'daily' :
                       recurringMatch[0].toLowerCase().includes('week') ? 'weekly' :
                       recurringMatch[0].toLowerCase().includes('month') ? 'monthly' :
                       recurringMatch[0].toLowerCase().includes('year') ? 'yearly' : 'weekly'

      recurrence = {
        frequency,
        time: '09:00',
        originalText: recurringMatch[0]
      }
      status = frequency
    } else {
      // Simple date detection (you can integrate chrono-node here for better parsing)
      const dateKeywords = ['tomorrow', 'today', 'tonight', 'next week', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      const hasDateKeyword = dateKeywords.some(keyword => correctedText.toLowerCase().includes(keyword))

      if (hasDateKeyword) {
        type = 'reminder'
        // Simple date logic - you can enhance this
        const now = new Date()
        if (correctedText.toLowerCase().includes('today') || correctedText.toLowerCase().includes('tonight')) {
          reminderDate = now.toISOString()
          status = 'today'
        } else if (correctedText.toLowerCase().includes('tomorrow')) {
          const tomorrow = new Date(now)
          tomorrow.setDate(tomorrow.getDate() + 1)
          reminderDate = tomorrow.toISOString()
          status = 'today'
        } else {
          // Default to 7+ days for other cases
          const future = new Date(now)
          future.setDate(future.getDate() + 7)
          reminderDate = future.toISOString()
          status = '7plus'
        }
      }
    }

    // Create the item
    const itemData: any = {
      type,
      title: correctedText,
      priority,
      status,
      listId,
      userId: user.id,
      notes: []
    }

    if (reminderDate) {
      itemData.reminderDate = reminderDate
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
      throw new Error('Failed to create item')
    }

    console.log(`Successfully created item: ${newItem.id}`)

    return new Response(
      JSON.stringify({
        success: true,
        item: {
          id: newItem.id,
          title: newItem.title,
          type: newItem.type,
          status: newItem.status,
          priority: newItem.priority
        }
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
        error: error.message || 'An error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
