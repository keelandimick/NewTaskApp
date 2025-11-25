import React from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  CollisionDetection,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Sidebar } from './components/Sidebar';
import { TaskBoard } from './components/TaskBoard';
import { DashboardView } from './components/DashboardView';
import { TaskCard } from './components/TaskCard';
import { Auth } from './components/Auth';
import { useStoreWithAuth } from './store/useStoreWithAuth';
import { useAuth } from './contexts/AuthContext';
import { TaskStatus, ReminderStatus } from './types';

function App() {
  const { user, loading } = useAuth();
  const { updateItem, moveItem, getFilteredItems, currentView, currentListId, displayMode, isDashboardView, setDashboardView, setSelectedItem, setHighlightedItem, selectedItemId } = useStoreWithAuth();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const items = getFilteredItems();
  const notesOpen = !!selectedItemId;

  // Dashboard reset threshold: 30 minutes
  const DASHBOARD_RESET_THRESHOLD = 30 * 60 * 1000; // milliseconds

  // Handle first launch and background/foreground logic
  React.useEffect(() => {
    // Check if this is the first launch
    const hasLaunchedBefore = localStorage.getItem('hasLaunchedBefore');
    if (!hasLaunchedBefore && user) {
      setDashboardView(true);
      localStorage.setItem('hasLaunchedBefore', 'true');
    }

    // Handle page visibility changes (background/foreground)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page going to background - save timestamp
        localStorage.setItem('backgroundTimestamp', Date.now().toString());
      } else {
        // Page coming to foreground - check how long it was backgrounded
        const backgroundTimestamp = localStorage.getItem('backgroundTimestamp');
        if (backgroundTimestamp) {
          const timeInBackground = Date.now() - parseInt(backgroundTimestamp, 10);

          if (timeInBackground > DASHBOARD_RESET_THRESHOLD) {
            // Was in background for > 30 minutes → show Dashboard
            setDashboardView(true);
            console.log(`📊 App was in background for ${Math.round(timeInBackground / 60000)} minutes → showing Dashboard`);
          } else {
            // Quick switch → keep current view
            console.log(`⚡️ Quick switch (${Math.round(timeInBackground / 1000)} seconds) → keeping current view`);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, setDashboardView, DASHBOARD_RESET_THRESHOLD]);

  // Get items in visual order for keyboard navigation
  const getVisuallyOrderedItems = () => {
    if (currentView !== 'tasks') {
      return items; // For reminders/recurring, use default order
    }

    if (displayMode === 'category') {
      // Sort by category alphabetically, with uncategorized last
      return [...items].sort((a, b) => {
        const catA = a.category || 'zzz_uncategorized';
        const catB = b.category || 'zzz_uncategorized';
        if (catA !== catB) return catA.localeCompare(catB);
        // Within same category, maintain priority order (already sorted)
        return 0;
      });
    } else {
      // Column mode - sort by status order (start, in-progress, complete)
      const statusOrder: { [key: string]: number } = { 'start': 0, 'in-progress': 1, 'complete': 2 };
      return [...items].sort((a, b) => {
        const orderA = statusOrder[a.status] ?? 999;
        const orderB = statusOrder[b.status] ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        // Within same column, maintain priority order (already sorted)
        return 0;
      });
    }
  };
  
  // Deselect item when changing views or lists
  React.useEffect(() => {
    setSelectedItem(null);
    setHighlightedItem(null);
  }, [currentView, currentListId, setSelectedItem, setHighlightedItem]);

  // Handle escape key to close notes when input is not focused
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedItemId) {
        // Check if any input or textarea is currently focused
        const activeElement = document.activeElement;
        const isInputFocused = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.getAttribute('contenteditable') === 'true'
        );

        if (!isInputFocused) {
          setSelectedItem(null);
          setHighlightedItem(null);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [selectedItemId, setSelectedItem, setHighlightedItem]);

  // Handle arrow key navigation
  React.useEffect(() => {
    const handleArrowKeys = (e: KeyboardEvent) => {
      if (!selectedItemId || currentView === 'trash' || currentView === 'complete') return;

      // Check if any input or textarea is currently focused
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true'
      );

      if (isInputFocused) return;

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();

        // Get items in visual order for navigation
        const visualItems = getVisuallyOrderedItems();

        // Get the current index of selected item in visual order
        const currentIndex = visualItems.findIndex(item => item.id === selectedItemId);
        if (currentIndex === -1) return;

        let newIndex = currentIndex;
        if (e.key === 'ArrowUp') {
          newIndex = Math.max(0, currentIndex - 1);
        } else {
          newIndex = Math.min(visualItems.length - 1, currentIndex + 1);
        }

        if (newIndex !== currentIndex && visualItems[newIndex]) {
          setSelectedItem(visualItems[newIndex].id);
          setHighlightedItem(null);
        }
      }
    };

    document.addEventListener('keydown', handleArrowKeys);
    return () => document.removeEventListener('keydown', handleArrowKeys);
  }, [selectedItemId, setSelectedItem, items, currentView, displayMode]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Custom collision detection that prioritizes columns over items
  const customCollisionDetection: CollisionDetection = (args) => {
    const collisions = rectIntersection(args);
    
    // Define column IDs
    const taskColumns = ['start', 'in-progress', 'complete'];
    const reminderColumns = ['today', 'within7', '7plus', 'complete'];
    const recurringColumns = ['daily', 'weekly', 'monthly', 'yearly'];
    const allColumns = [...taskColumns, ...reminderColumns, ...recurringColumns, 'trash'];
    
    // If there are collisions with columns, prioritize them
    const columnCollisions = collisions.filter(collision => 
      allColumns.includes(collision.id as string) || 
      (collision.id as string).startsWith('list-')
    );
    
    if (columnCollisions.length > 0) {
      return columnCollisions;
    }
    
    // Otherwise return all collisions (items)
    return collisions;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const itemId = active.id as string;
    const overId = over.id as string;

    // Check if dropping on a list in sidebar
    if (overId.startsWith('list-')) {
      const newListId = overId.replace('list-', '');
      const item = items.find(i => i.id === itemId);

      // Guard check: Don't update if item is already in this list
      if (item && item.listId === newListId) {
        setActiveId(null);
        return;
      }

      // Clear category when moving to a new list (categories are list-specific)
      updateItem(itemId, { listId: newListId, category: undefined });
    } else {
      // Handle dropping on columns or cards
      const taskColumns = ['start', 'in-progress', 'complete'];
      const reminderColumns = ['today', 'within7', '7plus', 'complete'];
      const recurringColumns = ['daily', 'weekly', 'monthly', 'yearly'];
      
      const columns = currentView === 'tasks' ? taskColumns : 
                      currentView === 'reminders' ? reminderColumns : 
                      recurringColumns;

      let newStatus: TaskStatus | ReminderStatus;
      
      // If dropping on a column directly
      if (columns.includes(overId)) {
        newStatus = overId as TaskStatus | ReminderStatus;
        
        if (currentView === 'tasks') {
          // Tasks can move to any column
          moveItem(itemId, newStatus);
        } else if (currentView === 'reminders' || currentView === 'recurring') {
          const activeItem = items.find(item => item.id === itemId);
          if (activeItem) {
            // Moving to complete
            if (overId === 'complete') {
              moveItem(itemId, newStatus);
            } 
            // Moving from complete back to active column
            else if (activeItem.status === 'complete') {
              moveItem(itemId, newStatus);
            }
          }
        }
      } else {
        // If dropping on another card, find which column it's in
        const targetItem = items.find(item => item.id === overId);
        if (targetItem) {
          const activeItem = items.find(item => item.id === itemId);
          if (activeItem && activeItem.status === targetItem.status) {
            // Same column - do nothing (reordering disabled)
            setActiveId(null);
            return;
          } else if (currentView === 'tasks') {
            // Different column - move (only in tasks view)
            newStatus = targetItem.status;
            moveItem(itemId, newStatus);
          }
        } else {
          setActiveId(null);
          return;
        }
      }
    }

    setActiveId(null);
  };

  const activeItem = activeId ? items.find(item => item.id === activeId) : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen bg-white">
        {/* Sidebar */}
        <Sidebar />

        {/* Dashboard or TaskBoard */}
        <main className="flex-1 overflow-hidden">
          {isDashboardView ? (
            <DashboardView />
          ) : (
            <TaskBoard activeId={activeId} notesOpen={notesOpen} />
          )}
        </main>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeItem ? <TaskCard item={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

export default App;
