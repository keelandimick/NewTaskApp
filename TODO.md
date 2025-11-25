# FlowTask TODO

## Known Issues

### 🔒 OpenAI API Keys Exposed (CRITICAL - Before Production)
- Both web (.env) and iOS (SupabaseService.swift:699) expose API keys client-side
- Solution: Move AI categorization to Supabase Edge Function (like Quick Add already does)

### Status Field Overloaded (Low Priority)
- `status` field serves different purposes: tasks (workflow), reminders (time proximity), recurring (frequency)
- Could use proper field separation eventually

### iOS Realtime Subscription (Medium Priority)
- Not receiving INSERT events from web → items only appear after manual refresh
- Likely cause: RLS policies blocking realtime events
- Workaround: Manual refresh works

---

## Todos

### 1. Bulk Import from Image/PDF (iOS)
- Camera/photo library integration
- OCR + AI extraction of tasks from images/PDFs
- Bulk add extracted tasks (similar to web import)

### 2. Fix Shared List Logic
- Work out shared list logic so it actually works
- Currently unfinished in both web and iOS
- Ensure proper multi-user collaboration

### 3. File Attachments
- Implement file attachment directly to items
- Allow users to attach files to tasks/reminders
- Display attached files in Notes section
- Support common file types (images, PDFs, documents)
- Store files in Supabase Storage

### 4. Move Title & Date Editing to Context Menu (Web)
- Remove inline title and date editing from Notes section
- Add to right-click context menu options instead
- Streamline Notes panel UX
