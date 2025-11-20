# FlowTask TODO

## Priority Tasks

### 1. Dark Mode Implementation
Implement full dark mode theme with toggle functionality
- Add dark mode styles across all components
- Persist dark mode preference
- Update theme-color meta tag dynamically

### 2. PWA Push Notifications
Enable push notifications for desktop and mobile
- Desktop push notifications via Web Push API
- Service Worker for background notifications
- PWA support for home screen installation
- Notification permissions UI

### 3. Categories/Columns Toggle for Reminders & Recurring Tabs
Implement category-based view organization
- Add categories/columns toggle for Reminders and Recurring tabs
- Use column titles as categories
- Code-based categorization only (no AI when refreshing categories)

### 4. File Attachments
Implement file attachment directly to items
- Allow users to attach files to tasks/reminders
- Display attached files in Notes section
- Support common file types (images, PDFs, documents)
- Store files in cloud storage (Firebase Storage)

## Future Features

### User Experience
- [ ] Multiple task selection with shift/cmd click
- [ ] Bulk operations (delete, move, complete)
- [ ] Task templates
- [ ] Subtasks
- [ ] Tags/labels system
- [ ] Undo/redo functionality
- [ ] Rich text notes with formatting
- [ ] File attachments

### Views & Organization
- [ ] Calendar view
- [ ] Gantt chart view
- [ ] Advanced search/filter functionality
- [ ] Custom task fields

### Productivity
- [ ] Due date notifications
- [ ] Time tracking
- [ ] Task dependencies
- [ ] Recurring task templates
- [ ] Export functionality (CSV, JSON)
- [ ] Activity history/audit log
- [ ] Integration with external calendars

### Technical Improvements
- [ ] Keyboard shortcuts for common actions
- [ ] Add proper TypeScript types (remove remaining `any` types)
- [ ] Implement error boundaries
- [ ] Add loading skeletons
- [ ] Extract magic numbers to constants
- [ ] Add unit tests for critical functions
- [ ] Add E2E tests for user flows
- [ ] Improve accessibility (ARIA labels)
- [ ] Add animations for transitions
- [ ] Add JSDoc comments for complex functions

### Performance
- [ ] Implement virtual scrolling for long lists
- [ ] Add pagination for large datasets
- [ ] Optimize re-renders with React.memo
- [ ] Implement proper caching strategy
- [ ] Add service worker for offline support
- [ ] Lazy load components
- [ ] Optimize image imports
- [ ] Optimize bundle size
