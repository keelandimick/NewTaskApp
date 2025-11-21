# Siri Integration for FlowTask

This guide will help you set up Siri voice input to quickly add tasks, reminders, and recurring items to FlowTask.

## Overview

Using iOS Shortcuts, you can say:
- "Hey Siri, quick add" → Dictate your task → It appears in FlowTask
- Works with tasks, reminders, and recurring items
- Automatically assigns to the right list using AI
- Detects dates and recurrence patterns

## Setup Steps

### 1. Deploy the Supabase Edge Function

First, deploy the `quick-add` function to Supabase:

```bash
# Login to Supabase CLI (if not already logged in)
npx supabase login

# Link your project (replace with your project ref)
npx supabase link --project-ref YOUR_PROJECT_REF

# Set the OpenAI API key secret
npx supabase secrets set OPENAI_API_KEY=your_openai_api_key_here

# Deploy the function
npx supabase functions deploy quick-add
```

After deployment, you'll get a function URL like:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/quick-add
```

### 2. Test the Function

Test it with curl (replace with your actual values):

```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/quick-add' \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "buy milk tomorrow"}'
```

You should get a response like:
```json
{
  "success": true,
  "item": {
    "id": "...",
    "title": "Buy milk",
    "type": "reminder",
    "status": "today",
    "priority": "low"
  }
}
```

### 3. Create iOS Shortcut

On your iPhone:

1. **Open Shortcuts app**

2. **Create new Shortcut** (tap + button)

3. **Add these actions in order:**

   a. **Ask for Input**
   - Prompt: "What do you want to add?"
   - Input Type: Text
   - (Enable "Request Dictation" for voice input)

   b. **Get Contents of URL**
   - URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/quick-add`
   - Method: POST
   - Headers:
     - `Authorization`: `Bearer YOUR_USER_JWT_TOKEN`
     - `Content-Type`: `application/json`
   - Request Body: JSON
   ```json
   {
     "text": "{{Provided Input}}"
   }
   ```

   c. **Get Dictionary from Input** (the response)

   d. **If** (success = true)
   - **Show Notification**
     - Title: "Added to FlowTask"
     - Body: "{{Dictionary: item.title}}"
   - **Otherwise**
   - **Show Notification**
     - Title: "Error"
     - Body: "Failed to add task"

4. **Name your shortcut**: "Quick Add" or "FlowTask"

5. **Add to Home Screen** (optional): Tap the info button and "Add to Home Screen"

### 4. Get Your JWT Token

To get your user JWT token:

1. Open FlowTask in your browser
2. Open Developer Console (F12)
3. Go to Application/Storage → Local Storage
4. Find `sb-YOUR_PROJECT_REF-auth-token`
5. Copy the `access_token` value

**Note**: JWT tokens expire after 1 hour by default. For a better long-term solution, you could:
- Use a refresh token flow (more complex)
- Create a dedicated API key for your personal use
- Set a longer token expiry in Supabase settings

### 5. Use with Siri

Now you can say:
- **"Hey Siri, Quick Add"**
- Siri will ask: "What do you want to add?"
- Say your task: "Buy groceries tomorrow"
- Siri confirms: "Added to FlowTask: Buy groceries"

## Examples

Here are some example voice commands and how they'll be processed:

| What you say | Result |
|-------------|--------|
| "Buy milk" | Task in first/matched list, status: start |
| "Call mom tomorrow" | Reminder for tomorrow, status: today |
| "Team meeting next week" | Reminder for 7+ days, status: 7plus |
| "Take vitamins daily" | Recurring daily reminder |
| "Review budget every month" | Recurring monthly reminder |
| "URGENT fix bug" | Task with priority: now |

## Smart Features

The AI automatically:
- ✅ Fixes spelling mistakes
- ✅ Assigns to the correct list based on keywords
- ✅ Detects priority (urgent, ASAP = now; soon = high)
- ✅ Identifies dates (tomorrow, next week, Monday, etc.)
- ✅ Recognizes recurrence patterns (daily, weekly, every month)
- ✅ Capitalizes properly (first letter + proper nouns only)

## Troubleshooting

### "Missing authorization header" error
- Make sure you added the Authorization header in the shortcut
- Check that your JWT token is correct and not expired

### "Failed to create item" error
- Check Supabase logs: `npx supabase functions logs quick-add`
- Verify OpenAI API key is set correctly

### Items not appearing in FlowTask
- Check if you're logged in with the same account
- Verify the item was created in Supabase dashboard

### Token expired
- Get a fresh JWT token from FlowTask (see step 4)
- Update the Authorization header in your shortcut

## Future Improvements

Possible enhancements:
- Use Supabase anon key + RLS policies (no JWT needed)
- Add more natural language processing
- Support for subtasks and notes via voice
- Integration with Apple Reminders import

## Questions?

Open an issue on GitHub or check the FlowTask documentation.
