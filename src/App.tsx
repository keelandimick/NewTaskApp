import React from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
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
  const { updateItem, moveItem, reorderItems, getFilteredItems, currentView, sortMode, setSortMode } = useStoreWithAuth();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const items = getFilteredItems();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );


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
      if (sortMode !== 'custom') {
        setSortMode('custom');
      }
      updateItem(itemId, { listId });
    } else {
      // Handle dropping on columns or cards
      const taskColumns = ['start', 'waiting', 'complete'];
      const reminderColumns = ['today', 'within7', '7plus', 'complete'];
      const recurringColumns = ['daily', 'weekly', 'monthly', 'yearly'];
      
      const columns = currentView === 'tasks' ? taskColumns : 
                      currentView === 'reminders' ? reminderColumns : 
                      recurringColumns;

      let newStatus: TaskStatus | ReminderStatus;
      
      // If dropping on a column directly
      if (columns.includes(overId)) {
        if (currentView === 'tasks') {
          newStatus = overId as TaskStatus | ReminderStatus;
          if (sortMode !== 'custom') {
            setSortMode('custom');
          }
          moveItem(itemId, newStatus);
        }
        // For other views, ignore column drops
      } else {
        // If dropping on another card, find which column it's in
        const targetItem = items.find(item => item.id === overId);
        if (targetItem) {
          const activeItem = items.find(item => item.id === itemId);
          if (activeItem && activeItem.status === targetItem.status) {
            // Same column - reorder
            if (sortMode !== 'custom') {
              setSortMode('custom');
            }
            reorderItems(itemId, overId);
          } else if (currentView === 'tasks') {
            // Different column - move (only in tasks view)
            newStatus = targetItem.status;
            if (sortMode !== 'custom') {
              setSortMode('custom');
            }
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
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen bg-white">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <TaskBoard activeId={activeId} />
        </main>
      </div>
      
      <DragOverlay>
        {activeItem ? <TaskCard item={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

export default App;
