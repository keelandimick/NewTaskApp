import React, { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';
import { Item, TaskStatus } from '../types';
import { useStoreWithAuth } from '../store/useStoreWithAuth';
import { useDndContext } from '@dnd-kit/core';

interface TaskColumnProps {
  title: string;
  items: Item[];
  columnId: string;
  onAddItem?: () => void;
}

export const TaskColumn: React.FC<TaskColumnProps> = ({ title, items, columnId, onAddItem }) => {
  const { currentView, addItem, currentListId, items: allItems } = useStoreWithAuth();
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { active } = useDndContext();
  
  // Helper function to calculate appropriate reminder column based on date
  const calculateReminderColumn = (reminderDate?: Date): string => {
    if (!reminderDate) return 'within7';
    
    const now = new Date();
    const reminder = new Date(reminderDate);
    
    // Reset time parts for date comparison
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const reminderDateOnly = new Date(reminder.getFullYear(), reminder.getMonth(), reminder.getDate());
    
    const diffTime = reminderDateOnly.getTime() - todayStart.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return 'today'; // Overdue goes to today
    } else if (diffDays === 0) {
      return 'today';
    } else if (diffDays <= 7) {
      return 'within7';
    } else {
      return '7plus';
    }
  };

  // Determine if this column should accept drops
  const isDropDisabled = (() => {
    if (currentView === 'trash') {
      return true; // No drops in trash
    } else if (currentView === 'tasks') {
      return false; // Tasks can drop anywhere
    } else if (currentView === 'reminders' || currentView === 'recurring') {
      // Check if we're dragging
      if (active) {
        const activeItem = allItems.find(item => item.id === active.id);
        if (activeItem) {
          // If dragging from complete column
          if (activeItem.status === 'complete') {
            // For reminders, only allow drop to the time-appropriate column
            if (currentView === 'reminders' && activeItem.type === 'reminder') {
              const appropriateColumn = calculateReminderColumn(activeItem.reminderDate);
              return columnId !== appropriateColumn;
            }
            // For recurring, allow drop based on recurrence frequency
            if (currentView === 'recurring' && activeItem.recurrence) {
              return columnId !== activeItem.recurrence.frequency;
            }
          }
          // If not from complete, only allow drops to complete column
          return columnId !== 'complete';
        }
      }
      // Default: only allow drops to complete column
      return columnId !== 'complete';
    }
    return true;
  })();

  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    disabled: isDropDisabled,
  });

  useEffect(() => {
    if (isAddingItem && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAddingItem]);

  const handleAddClick = () => {
    if (onAddItem && currentView !== 'tasks') {
      // For non-task views, use the modal
      onAddItem();
    } else {
      // For task view, use inline input
      setIsAddingItem(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim()) {
      setIsAddingItem(false);
      return;
    }

    try {
      await addItem({
        type: 'task',
        title: newItemTitle.trim(),
        priority: 'low',
        status: columnId as TaskStatus,
        listId: currentListId,
      });
      setNewItemTitle('');
      setIsAddingItem(false);
    } catch (error) {
      console.error('Failed to add item:', error);
      alert('Failed to add item. Please try again.');
    }
  };

  const handleCancel = () => {
    setNewItemTitle('');
    setIsAddingItem(false);
  };

  const handleInputBlur = () => {
    if (!newItemTitle.trim()) {
      handleCancel();
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 flex flex-col transition-colors relative ${
        isOver ? 'bg-blue-50' : ''
      }`}
    >
      <div className={`flex justify-between items-center px-3 py-2 border-b ${
        isOver ? 'bg-blue-100 border-blue-200' : 'border-gray-200'
      }`}>
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</h3>
        <span className="text-xs text-gray-400">{items.length}</span>
      </div>

      {/* Invisible drop overlay that sits above everything when dragging */}
      {isOver && (
        <div className="absolute inset-0 bg-blue-100 opacity-30 pointer-events-none z-10" />
      )}

      <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 relative">
          {items.map((item) => (
            <TaskCard key={item.id} item={item} />
          ))}
          
          {onAddItem && (
            <>
              {isAddingItem ? (
                <form onSubmit={handleSubmit} className="px-3 py-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    onBlur={handleInputBlur}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        handleCancel();
                      }
                    }}
                    placeholder="New task..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </form>
              ) : (
                <button
                  onClick={handleAddClick}
                  className="w-full px-3 py-3 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors text-left"
                >
                  + Add item
                </button>
              )}
            </>
          )}
        </div>
      </SortableContext>
    </div>
  );
};