# Task App Development Guide & Todo List

## Overview
This is a task management app built with React, TypeScript, and Tailwind CSS. It features three views (Tasks, Reminders, Recurring), drag-and-drop functionality, and automatic/manual sorting.

## Architecture
- **State Management**: Zustand
- **Drag & Drop**: @dnd-kit
- **Styling**: Tailwind CSS with CRACO
- **Date Handling**: date-fns

## Code Cleanup Todo List

### High Priority - Performance
- [ ] Add `useMemo` to expensive computations in `getFilteredItems()`
- [ ] Implement React.memo for TaskCard, TaskColumn components
- [ ] Cache sorted/filtered results in the store
- [ ] Optimize re-renders by splitting the store into slices

### Medium Priority - Code Quality
- [ ] Remove unused `QuickAdd.tsx` component
- [ ] Extract shared constants to a dedicated file:
  - Column definitions (currently duplicated in App.tsx and TaskBoard.tsx)
  - Priority colors and labels
  - Date format strings
- [ ] Replace all `any` types with proper TypeScript interfaces:
  - `updates: any` in moveItem function
  - Status casting in getFilteredItems
- [ ] Create utility functions for:
  - Date formatting (consolidate from TaskCard and TaskModal)
  - Status calculations
- [ ] Split TaskModal into CreateTaskModal and EditTaskModal components

### Low Priority - Features & Polish
- [ ] Add error boundaries for better error handling
- [ ] Implement proper loading states
- [ ] Add keyboard navigation support (arrow keys for navigation)
- [ ] Add ARIA labels for accessibility
- [ ] Add animations for task transitions
- [ ] Implement undo/redo functionality
- [ ] Add task search/filter functionality
- [ ] Add data persistence (localStorage or backend)

### Code Organization
- [ ] Move magic numbers to constants:
  ```typescript
  const HIGHLIGHT_DURATION = 2000; // instead of hardcoded 2000ms
  const DEFAULT_REMINDER_TIME = '09:00';
  ```
- [ ] Create a `constants/` directory with:
  - `columns.ts` - All column definitions
  - `colors.ts` - Theme colors and priority colors
  - `defaults.ts` - Default values

### Testing
- [ ] Add unit tests for store actions
- [ ] Add component tests for critical user flows
- [ ] Add integration tests for drag-and-drop

### Documentation
- [ ] Add JSDoc comments to complex functions
- [ ] Create a README with setup instructions
- [ ] Document the store structure and data flow

## Quick Wins (Can do in 15 minutes)
1. Delete `src/components/QuickAdd.tsx`
2. Extract column definitions to constants
3. Fix the `any` types in useStore.ts
4. Add `useMemo` to wrap `getFilteredItems()` calls

## Future Feature Ideas
- [ ] Multiple task selection with shift/cmd click
- [ ] Bulk operations (delete, move, complete)
- [ ] Task templates
- [ ] Subtasks
- [ ] Tags/labels system
- [ ] Due date notifications
- [ ] Calendar view
- [ ] Export/import functionality
- [ ] Collaboration features (share lists)
- [ ] Mobile responsive design

## Known Issues
- CMD+N shortcut doesn't work due to browser limitations
- No data persistence (refreshing loses all data)
- No proper date picker component (using browser default)

## Development Notes
- The app is already quite polished for a one-night build
- The drag-and-drop implementation is solid
- The UI is clean and follows modern design patterns
- State management with Zustand is well-implemented
- TypeScript usage is generally good with room for improvement