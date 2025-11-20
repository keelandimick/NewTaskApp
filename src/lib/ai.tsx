import React from 'react';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Note: In production, you should use a backend proxy
});

interface ProcessedText {
  correctedText: string;
  hasLinks: boolean;
  suggestedListId?: string;
  suggestedPriority?: 'now' | 'high' | 'low';
}

// Function to detect URLs in text
function detectUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?(?:\/[^\s]*)?)/g;
  return text.match(urlRegex) || [];
}

// Function to process text with AI and match to lists
export async function processTextWithAI(text: string, lists?: Array<{id: string, name: string}>): Promise<ProcessedText> {
  try {
    // Single combined AI call for better performance
    const response = await openai.chat.completions.create({
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
    });

    let content = response.choices[0]?.message?.content || '{}';

    // Remove markdown code blocks if present
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    const parsed = JSON.parse(content);

    const correctedText = parsed.correctedText || text;
    let suggestedListId: string | undefined;

    // Verify the list ID exists
    if (parsed.listId && lists && lists.find(l => l.id === parsed.listId)) {
      suggestedListId = parsed.listId;
    }

    const urls = detectUrls(correctedText);

    return {
      correctedText: correctedText.trim(),
      hasLinks: urls.length > 0,
      suggestedListId,
      suggestedPriority: parsed.priority || 'low'
    };
  } catch (error) {
    console.error('AI processing error:', error);
    // Fallback to original text if AI fails
    return {
      correctedText: text,
      hasLinks: detectUrls(text).length > 0,
      suggestedPriority: 'low'
    };
  }
}

// Function to render text with clickable links
export function renderTextWithLinks(text: string): React.ReactNode {
  // Simplified regex that matches full URLs
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?(?:\/[^\s]*)?)/g;
  
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  
  // Find all matches
  while ((match = urlRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }
    
    // Add the link
    const url = match[0];
    const href = url.startsWith('http') ? url : `https://${url}`;
    elements.push(
      <a
        key={match.index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline hover:text-blue-800"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text after last match
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }
  
  return <>{elements}</>;
}

// Function to categorize items using AI
export async function categorizeItems(
  itemsToCategorize: Array<{id: string, title: string}>,
  listName: string,
  existingCategorizedItems?: Array<{id: string, title: string, category: string}>
): Promise<Array<{id: string, category: string}>> {
  try {
    if (itemsToCategorize.length === 0) {
      return [];
    }

    // Build context about existing categories
    const existingCategoriesContext = existingCategorizedItems && existingCategorizedItems.length > 0
      ? `\n\nEXISTING CATEGORIES AND ITEMS (for context):\n${
          // Group by category
          Object.entries(
            existingCategorizedItems.reduce((acc, item) => {
              if (!acc[item.category]) acc[item.category] = [];
              acc[item.category].push(item.title);
              return acc;
            }, {} as Record<string, string[]>)
          ).map(([cat, titles]) => `${cat}:\n${titles.map(t => `  - ${t}`).join('\n')}`).join('\n\n')
        }`
      : '';

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that organizes tasks into categories.

Given uncategorized items and existing categories (if any), assign the uncategorized items to appropriate categories.

IMPORTANT RULES:
1. Review the uncategorized items to understand what needs to be categorized
2. If existing categories are provided, consider using them when appropriate
3. You may create NEW categories if the uncategorized items don't fit existing ones
4. You may CONSOLIDATE categories - if it makes sense to merge existing categories with new items, do so
5. Categories should be:
   - Contextually appropriate for a "${listName}" list
   - Short and clear (1-3 words max)
   - Logical groupings that help organize tasks
6. Each uncategorized item must be assigned to exactly one category
7. Aim for 3-7 total categories (including existing ones)

Examples of good categories:
- "Personal" list: Shopping, Health, Home, Family, Errands
- "Work" list: Meetings, Projects, Admin, Clients
- "Fitness" list: Cardio, Strength, Meal Prep, Recovery

Return a JSON object with this exact format:
{
  "assignments": [
    {"id": "item-id-1", "category": "Category Name"},
    {"id": "item-id-2", "category": "Another Category"}
  ]
}

ONLY return assignments for the uncategorized items provided.`
        },
        {
          role: "user",
          content: `List name: "${listName}"${existingCategoriesContext}\n\nUNCATEGORIZED ITEMS TO ASSIGN:\n${itemsToCategorize.map(item => `- ${item.title} (id: ${item.id})`).join('\n')}\n\nAssign each uncategorized item to the most appropriate category (existing or new). Return only the JSON object.`
        }
      ],
      temperature: 0.4,
      max_tokens: 2000
    });

    let content = response.choices[0]?.message?.content || '{"categories":[],"assignments":[]}';

    // Remove markdown code blocks if present
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    const parsed = JSON.parse(content);

    // Return the assignments
    return parsed.assignments || [];
  } catch (error) {
    console.error('Categorization error:', error);
    // Return uncategorized items on error
    return itemsToCategorize.map(item => ({
      id: item.id,
      category: 'Uncategorized'
    }));
  }
}

// Function to extract tasks from image or text
export async function extractTasksFromImage(base64Image: string, _fileType: 'image' | 'pdf', lists: Array<{id: string, name: string}>): Promise<Array<{title: string, listId: string, priority: 'now' | 'high' | 'low'}>> {
  try {
    // For images, use GPT-4 Vision
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that extracts tasks from images or documents.
          Extract each task as a separate item. Clean up the text, fix spelling, and match each task to the most appropriate list.
          
          Available lists: ${lists.map(l => l.name).join(', ')}
          
          Return a JSON array of objects with format: [{"title": "task text", "listName": "matching list name", "priority": "now|high|low"}]
          
          Rules:
          1. Extract each task/to-do item as a separate entry
          2. Fix spelling and capitalize properly (first letter and proper nouns only)
          3. Match each task to the most appropriate list based on content
          4. Remove bullet points, numbers, or task markers
          5. Keep URLs exactly as written
          6. If no clear list match, use the first available list
          7. Assign priority based on urgency indicators:
             - "now" for: urgent, ASAP, immediately, today, critical, emergency, important, !!!, ***
             - "high" for: soon, tomorrow, this week, priority, deadline, !, **, HIGH
             - "low" for: everything else (default)
          8. Look for exclamation marks, ALL CAPS, or stars/asterisks as urgency indicators`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all tasks from this image:"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1500
    });

    let content = response.choices[0]?.message?.content || '[]';
    
    // Remove markdown code blocks if present
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    const parsedTasks = JSON.parse(content);
    
    // Map list names back to IDs and ensure priority
    return parsedTasks.map((task: any) => {
      const matchingList = lists.find(l => l.name.toLowerCase() === task.listName.toLowerCase());
      return {
        title: task.title,
        listId: matchingList?.id || lists[0]?.id,
        priority: task.priority || 'low'
      };
    });
  } catch (error) {
    console.error('Task extraction error:', error);
    return [];
  }
}