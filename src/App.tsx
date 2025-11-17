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
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Sidebar } from './components/Sidebar';
import { TaskBoard } from './components/TaskBoard';
import { TaskCard } from './components/TaskCard';
import { Auth } from './components/Auth';
import { Notes } from './components/Notes';
import { useStoreWithAuth } from './store/useStoreWithAuth';
import { useAuth } from './contexts/AuthContext';
import { TaskStatus, ReminderStatus } from './types';

function App() {
  const { user, loading } = useAuth();
  const { updateItem, moveItem, getFilteredItems, currentView, currentListId, setSelectedItem, selectedItemId } = useStoreWithAuth();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [notesOpen, setNotesOpen] = React.useState(false);
  const [notesHeight, setNotesHeight] = React.useState(300);
  const items = getFilteredItems();
  
  // Auto-open notes when an item is selected, close when none selected
  React.useEffect(() => {
    if (selectedItemId && !notesOpen) {
      setNotesOpen(true);
    } else if (!selectedItemId && notesOpen) {
      setNotesOpen(false);
    }
  }, [selectedItemId, notesOpen]);

  // Scroll selected item into view when notes are open
  React.useEffect(() => {
    if (selectedItemId && notesOpen) {
      // Small delay to ensure DOM updates
      setTimeout(() => {
        const selectedElement = document.querySelector(`[data-item-id="${selectedItemId}"]`);
        if (selectedElement) {
          const mainElement = document.querySelector('main');
          if (mainElement) {
            const elementRect = selectedElement.getBoundingClientRect();
            const mainRect = mainElement.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const availableHeight = viewportHeight - notesHeight - 100; // 100px for padding
            
            // Check if element is below the visible area or too close to notes
            if (elementRect.bottom > availableHeight || elementRect.top > availableHeight - 100) {
              const scrollTop = mainElement.scrollTop;
              const elementOffsetTop = elementRect.top - mainRect.top + scrollTop;
              const targetScrollTop = elementOffsetTop - 100; // Position 100px from top
              
              mainElement.scrollTo({
                top: targetScrollTop,
                behavior: 'smooth'
              });
            }
            // Also check if element is too high up
            else if (elementRect.top < mainRect.top + 50) {
              const scrollTop = mainElement.scrollTop;
              const elementOffsetTop = elementRect.top - mainRect.top + scrollTop;
              const targetScrollTop = elementOffsetTop - 100;
              
              mainElement.scrollTo({
                top: targetScrollTop,
                behavior: 'smooth'
              });
            }
          }
        }
      }, 100);
    }
  }, [selectedItemId, notesOpen, notesHeight]);
  
  // Close notes when changing views or lists
  React.useEffect(() => {
    setNotesOpen(false);
    setSelectedItem(null);
  }, [currentView, currentListId, setSelectedItem]);

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
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen bg-white">
        <Sidebar />
        <main 
          className="flex-1 overflow-hidden transition-all duration-300"
          style={{ marginBottom: notesOpen ? `${notesHeight}px` : '48px' }}
        >
          <TaskBoard activeId={activeId} />
        </main>
        <Notes 
          isOpen={notesOpen}
          onToggle={() => setNotesOpen(!notesOpen)}
          height={notesHeight}
          onHeightChange={setNotesHeight}
        />
      </div>
      
      <DragOverlay dropAnimation={null}>
        {activeItem ? <TaskCard item={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

export default App;
