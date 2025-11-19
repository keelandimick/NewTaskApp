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
import { TaskCard } from './components/TaskCard';
import { Auth } from './components/Auth';
import { useStoreWithAuth } from './store/useStoreWithAuth';
import { useAuth } from './contexts/AuthContext';
import { TaskStatus, ReminderStatus } from './types';

function App() {
  const { user, loading } = useAuth();
  const { updateItem, moveItem, getFilteredItems, currentView, currentListId, setSelectedItem, setHighlightedItem, selectedItemId } = useStoreWithAuth();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const items = getFilteredItems();
  const notesOpen = !!selectedItemId;
  
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
        
        // Get the current index of selected item
        const currentIndex = items.findIndex(item => item.id === selectedItemId);
        if (currentIndex === -1) return;
        
        let newIndex = currentIndex;
        if (e.key === 'ArrowUp') {
          newIndex = Math.max(0, currentIndex - 1);
        } else {
          newIndex = Math.min(items.length - 1, currentIndex + 1);
        }
        
        if (newIndex !== currentIndex && items[newIndex]) {
          setSelectedItem(items[newIndex].id);
          setHighlightedItem(null);
        }
      }
    };

    document.addEventListener('keydown', handleArrowKeys);
    return () => document.removeEventListener('keydown', handleArrowKeys);
  }, [selectedItemId, setSelectedItem, items, currentView]);

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
      const listId = overId.replace('list-', '');
      updateItem(itemId, { listId });
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
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <TaskBoard activeId={activeId} notesOpen={notesOpen} />
        </main>
      </div>
      
      <DragOverlay dropAnimation={null}>
        {activeItem ? <TaskCard item={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

export default App;
