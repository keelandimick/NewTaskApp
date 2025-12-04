# FlowTask TODO

## Known Issues

### 🔒 OpenAI API Keys Exposed (CRITICAL - Before Production)
- Both web (.env) and iOS (SupabaseService.swift:699) expose API keys client-side
- Solution: Move AI categorization to Supabase Edge Function (like Quick Add already does)

### 🐛 Reminder/Recurring Bugs (NEEDS FULL AUDIT)
**Date/Time Stripping Issues:**
- Web version kept "every" in title and added as reminder instead of recurring
- Abbreviations like "thurs" may not be recognized properly
- Text stripping not working consistently for recurring items
- Including words like "now" or "November" when not intending to add date/time is problematic

**Root Cause Investigation Needed:**
- Audit recurrence detection in `quick-add` edge function
- Verify "every" keyword triggers recurrence path (not reminder)
- Check day abbreviation patterns (thurs, thur, thu vs thursday)
- Ensure `strip_text` / `originalText` properly removes matched patterns

---

## Todos

### 2. Server-Side Push Notifications (Cross-Platform Reminders)
**Problem:** Currently using local notifications scheduled on-device. When a task with a reminder is created from web (or any source outside the iOS app), the iOS app must be open/foreground to receive the real-time sync and schedule the local notification. If the app is in background or closed, no notification is scheduled.

**Solution Options:**

**Option A: Direct Push Notifications (Simpler)**
- Setup APNs (Apple Push Notification Service) in Apple Developer account
- Register device tokens in iOS app, store in Supabase
- Create Supabase Edge Function triggered when reminder time arrives
- Server sends push notification directly via APNs - no local scheduling needed

**Option B: Silent Push to Trigger Local Notification**
- Same APNs setup
- When reminder is created, server sends silent push to wake iOS app
- iOS app syncs task and schedules local notification
- More complex, but allows richer local notification customization
