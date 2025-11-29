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

**Root Cause Investigation Needed:**
- Audit recurrence detection in `quick-add` edge function
- Verify "every" keyword triggers recurrence path (not reminder)
- Check day abbreviation patterns (thurs, thur, thu vs thursday)
- Ensure `strip_text` / `originalText` properly removes matched patterns

---

## Todos

### 1. File Attachments
- Implement file attachment directly to items
- Allow users to attach files to tasks/reminders
- Display attached files in Notes section
- Support common file types (images, PDFs, documents)
- Store files in Supabase Storage

### 2. Silent Push Notifications (iOS Background Sync)
- Enable notifications for reminders created on web without opening iOS app
- Setup APNs (Apple Push Notification Service) in Apple Developer account
- Create Supabase Edge Function to send silent push when reminder is created
- iOS receives silent push, wakes briefly, syncs task, schedules local notification
- Ensures cross-platform reminder notifications work reliably
