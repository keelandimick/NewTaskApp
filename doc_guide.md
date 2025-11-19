# FlowTask Development Guide & Todo List

## Overview
A modern task management app with lists, reminders, and recurring tasks built with React, TypeScript, and Supabase.

## Features
- **Three Views**: Tasks, Reminders, Recurring
- **Drag & Drop**: Move items between columns
- **Lists**: Create and manage multiple lists with colors
- **Sharing**: Share lists with other users
- **Notes**: Add notes to tasks with special "on hold" status
- **Import**: Import tasks from images/PDFs
- **AI Integration**: Smart categorization and spell checking
- **Keyboard Navigation**: Arrow keys to navigate between tasks
- **Dark Mode**: Toggle between light and dark themes
- **Authentication**: User accounts with Supabase Auth

## Architecture
- **Frontend**: React, TypeScript
- **State Management**: Zustand
- **Database**: Supabase (PostgreSQL)
- **Drag & Drop**: @dnd-kit
- **Styling**: Tailwind CSS
- **Date Handling**: date-fns, Chrono
- **AI**: OpenAI integration

## Implemented Features ✅
- User authentication and accounts
- Multiple lists with custom colors
- Task/reminder creation with AI categorization
- Drag and drop between columns
- Notes system with "on hold" status
- Import from images/PDFs
- List sharing with other users (UI only - real-time sync pending)
- Dark mode toggle
- Mobile responsive design
- Keyboard navigation (up/down arrows)
- Duplicate prevention (excludes completed/trashed items)
- Auto-close notes when task is deleted
- Column drop zone highlighting
- Optimistic UI updates with state protection
- Cache-busting for Supabase queries
- Global search with keyboard shortcut (⌘K/Ctrl+K)
- Search result navigation to item's list/view
- Persistent highlight until dismissed
- User-specific preferences (Show All list setting)

## Priority Tasks 🎯

### 0. Quick Fixes
- [ ] Fix dark mode toggle - currently doesn't apply dark styles properly
- [x] Add keyboard shortcut (⌘I / Ctrl+I) to open "Add item" modal

### 1. Push Notifications
**Status**: Not implemented
**Description**: Enable push notifications for reminders and shared list updates
**Requirements**:
- Desktop push notifications via Web Push API
- Service Worker for background notifications
- PWA support for iOS home screen (limited notification support)
- Notification permissions UI

**Limitations**:
- iOS Safari has limited Web Push support (requires iOS 16.4+ and user must add to home screen)
- No Siri integration without native app or Shortcuts integration
- Notifications may be delayed when app is not open on mobile

**Implementation Notes**:
- Use Supabase Edge Functions or Firebase Cloud Messaging for push delivery
- Store push subscription tokens in database
- Send notifications for:
  - Reminder due dates/times
  - Shared list updates (when collaborator makes changes)
  - Recurring task triggers

### 2. Real-Time Collaboration (Shared Lists)
**Status**: Broken - UI implemented but sync not working
**Description**: Fix real-time synchronization for shared lists

**Current State**:
- ✅ UI for sharing lists (email-based)
- ✅ Database RLS policies allow shared access
- ✅ `getLists()` and `getItems()` fetch shared lists correctly
- ❌ No real-time sync - changes only appear after polling (30s)
- ❌ No notification when collaborator makes changes

**Issues Found**:
- No Supabase Realtime subscriptions implemented
- App uses polling every 30 seconds (src/store/useStoreWithAuth.ts)
- Users don't see collaborator changes until next poll
- No conflict resolution for simultaneous edits

**Required Changes**:
1. Add Supabase Realtime subscriptions for:
   - `items` table (INSERT, UPDATE, DELETE)
   - `lists` table (UPDATE, DELETE)
   - `notes` table (INSERT, UPDATE, DELETE)

2. Filter subscriptions to only listen to accessible lists:
   - User's own lists (user_id = current user)
   - Shared lists (shared_with contains user email)

3. Update store when realtime events fire:
   - Merge incoming changes with local state
   - Respect `recentlyUpdatedItems` to prevent overwriting local changes
   - Show toast notification when collaborator makes changes

4. Handle edge cases:
   - List deleted by owner while collaborator viewing
   - Item moved between lists
   - Collaborator removed from shared list

**Files to Update**:
- `src/store/useStore.ts` - Add subscription management
- `src/store/useStoreWithAuth.ts` - Set up realtime listeners
- `src/lib/database.ts` - Add subscription helper functions

**Testing Checklist**:
- [ ] User A adds item to shared list → User B sees it immediately
- [ ] User A edits item title → User B sees update
- [ ] User A deletes item → User B sees deletion
- [ ] User A moves item between columns → User B sees move
- [ ] Owner deletes shared list → Collaborators redirected gracefully
- [ ] Owner removes collaborator → Collaborator loses access immediately
- [ ] Simultaneous edits don't cause data loss

## Future Feature Ideas
- [ ] Multiple task selection with shift/cmd click
- [ ] Bulk operations (delete, move, complete)
- [ ] Task templates
- [ ] Subtasks
- [ ] Tags/labels system
- [ ] Due date notifications
- [ ] Calendar view
- [ ] Task search/filter functionality
- [ ] Undo/redo functionality
- [ ] Time tracking
- [ ] Task dependencies
- [ ] Recurring task templates
- [ ] Export functionality (CSV, JSON)
- [ ] Keyboard shortcuts for common actions
- [ ] Rich text notes with formatting
- [ ] File attachments
- [ ] Activity history/audit log
- [ ] Custom task fields
- [ ] Gantt chart view
- [ ] Integration with external calendars

## Code Quality Improvements
- [ ] Add proper TypeScript types (remove remaining `any` types)
- [ ] Implement error boundaries
- [ ] Add loading skeletons
- [ ] Extract magic numbers to constants
- [ ] Add unit tests for critical functions
- [ ] Add E2E tests for user flows
- [ ] Improve accessibility (ARIA labels)
- [ ] Add animations for transitions
- [ ] Optimize bundle size
- [ ] Implement proper error handling and user feedback
- [ ] Add JSDoc comments for complex functions

## Performance Optimizations
- [ ] Implement virtual scrolling for long lists
- [ ] Add pagination for large datasets
- [ ] Optimize re-renders with React.memo
- [ ] Implement proper caching strategy
- [ ] Add service worker for offline support
- [ ] Lazy load components
- [ ] Optimize image imports

## Known Limitations
- Browser prevents Cmd+N override (opens new tab)
- Supabase eventual consistency can cause brief delays
- No offline support
- Limited to Supabase's rate limits
- **Collaboration**: Shared lists don't sync in real-time (30-second polling delay)
- **Push Notifications**: Not implemented yet
- **iOS Siri Integration**: Not possible without native app or Shortcuts

## Development Notes
- The app uses Supabase for backend services
- AI integration requires OpenAI API key
- Authentication is handled by Supabase Auth
- Database schema includes RLS policies for security
- Local state management prevents race conditions
- The drag-and-drop implementation is solid and responsive

## Quick Start
1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see .env.example)
4. Run development server: `npm start`
5. Build for production: `npm run build`