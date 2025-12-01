# FlowTask

A modern task management app with lists, reminders, and recurring tasks built with React, TypeScript, and Supabase.

## Features

### Core Functionality
- **Dashboard View**: At-a-glance summary of NOW tasks, today's reminders, and recurring items
- **Three Views**: Tasks, Reminders, Recurring (plus Trash and Complete)
- **Two Display Modes**: Column View (status-based) and Category View (AI-organized)
- **Smart Lists**: Create and manage multiple lists with 8 custom colors
- **Drag & Drop**: Move items between columns with smooth interactions
- **Notes System**: Add notes to tasks with special "on hold" status tracking
- **File Attachments**: Attach images and PDFs to any task with drag-and-drop support
- **Global Search**: Find tasks across all lists with ⌘K/Ctrl+K

### Collaboration
- **List Sharing**: Share lists with other users via email (with validation)
- **Real-Time Sync**: See collaborator changes instantly in shared lists
- **Isolated Updates**: Personal lists remain fast with optimistic updates

### AI-Powered
- **Smart List Assignment**: AI automatically assigns new tasks to the most appropriate list based on content
- **AI Categorization**: Organize tasks by AI-generated categories within lists
- **Context-Aware**: Analyzes keywords and context (e.g., "business meeting" → Work list)
- **User-Triggered**: Manual control over when to categorize existing tasks
- **Smart Import**: Import tasks from images and PDFs with progress tracking and automatic list matching
- **Spell Check**: Automatic spelling correction when creating tasks and notes

### User Experience
- **Quick Add**: Create tasks quickly with ⌘I/Ctrl+I modal
- **Keyboard Navigation**: Navigate tasks with arrow keys, delete with Delete/Backspace
- **Keyboard Shortcuts**: ⌘I (quick add), ⌘K (search), Escape (close modals)
- **Dark Mode**: System preference detection + manual toggle
- **Context Menus**: Right-click lists to rename
- **Visual Feedback**: Item highlighting after navigation
- **Mobile Responsive**: Works on desktop, tablet, and mobile browsers
- **PWA Ready**: Add to home screen on Safari/Chrome

### Authentication
- **Email/Password Auth**: Sign up with email verification
- **Password Reset**: Reset password via email link
- **Persistent Sessions**: Stay logged in across browser sessions

## Tech Stack

### Frontend
- **React 19** with TypeScript
- **Zustand** for state management
- **Tailwind CSS** for styling
- **@dnd-kit** for drag and drop
- **date-fns** & **Chrono** for natural language date parsing

### Backend & Services
- **Supabase** (PostgreSQL + Realtime + Auth + Edge Functions + Storage)
- **OpenAI** (GPT-4o-mini) for AI features

### Browser Support
- Chrome, Firefox, Safari, Edge (modern versions)

## Getting Started

### Prerequisites
- Node.js 16+
- Supabase account
- OpenAI API key (for AI features)

### Installation
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your Supabase and OpenAI credentials

# Run development server
npm start

# Build for production
npm run build
```

### Environment Variables
```
REACT_APP_SUPABASE_URL=your-supabase-url
REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key
REACT_APP_OPENAI_API_KEY=your-openai-api-key
```

## Key Concepts

### Dashboard
- Automatically shows when opening the app or returning after 30+ minutes
- Displays NOW priority tasks, today's reminders, and daily/weekly recurring items
- Quick access to items that need attention

### Views & Display Modes
- **Tasks**: Items without dates, organized by priority (NOW, NEXT, LATER)
- **Reminders**: Items with dates, organized by timing (Overdue, Today, Upcoming, Someday)
- **Recurring**: Repeating items, organized by frequency (Daily, Weekly, Monthly, Yearly)
- **Trash**: Soft-deleted items awaiting permanent deletion
- **Complete**: Finished items for reference

Toggle between **Column View** (status-based columns) and **Category View** (AI-organized categories) for any view.

### Real-Time Collaboration
- **Shared Lists**: Automatic real-time sync via Supabase Realtime
- **Personal Lists**: Fast optimistic updates with polling backup
- **Conflict Prevention**: Your changes take priority during updates
- **Email Validation**: Verifies users exist before sharing

### AI Categorization
- Categories are context-aware (e.g., "Work" list won't suggest "Personal" categories)
- Consolidates similar categories intelligently
- Manual re-categorization on demand via "Categorize" button

### On Hold Status
- Add a note starting with "on hold" to mark an item as on hold
- Add a note with "off hold" to remove the hold status
- Visual badge indicates hold status on items

### File Attachments
- Attach images and PDFs to any task (10MB max per file)
- Upload via "+ Add" button in the notes panel or right-click context menu
- Drag and drop files directly onto the notes panel
- Click thumbnail to view in new tab, hover for download/delete buttons
- Paperclip icon on task cards indicates attachments exist

### Data Management
- **Soft Deletes**: Items move to trash before permanent deletion
- **Duplicate Prevention**: Case-insensitive checking, excludes completed/trashed items
- **User Preferences**: Persistent settings per user (dark mode, list visibility)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘K / Ctrl+K | Open global search |
| ⌘I / Ctrl+I | Open quick add modal |
| ↑ / ↓ | Navigate between tasks |
| Delete / Backspace | Delete selected item |
| Escape | Close modals and notes panel |

## Project Structure
```
src/
├── components/     # React components (TaskBoard, TaskCard, Sidebar, etc.)
├── contexts/       # Auth context for authentication state
├── lib/            # AI, database, Supabase client, date utilities
├── store/          # Zustand state management
├── types/          # TypeScript type definitions
└── utils/          # Helper functions and constants
```

## Known Limitations
- Browser prevents Cmd+N override (opens new tab instead)
- Supabase eventual consistency can cause brief delays
- No offline support yet
- Limited to Supabase's rate limits

## License
Private project - all rights reserved
