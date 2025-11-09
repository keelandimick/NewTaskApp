import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Item, Priority } from '../types';
import { useStoreWithAuth } from '../store/useStoreWithAuth';
import { format } from 'date-fns';
import { TaskModal } from './TaskModal';

interface TaskCardProps {
  item: Item;
}

const priorityColors: Record<Priority, string> = {
  now: 'bg-red-600',
  high: 'bg-orange-500',
  low: 'bg-green-600',
};

const priorityLabels: Record<Priority, string> = {
  now: 'Now',
  high: 'High',
  low: 'Low',
};

export const TaskCard: React.FC<TaskCardProps> = ({ item }) => {
  const { deleteItem, currentView, highlightedItemId, lists } = useStoreWithAuth();
  const [showEditModal, setShowEditModal] = React.useState(false);
  const isHighlighted = highlightedItemId === item.id;
  
  // Enable dragging for all views (for reordering within columns)
  const isDraggable = true;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: item.id,
    disabled: !isDraggable
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOverdue = item.type === 'reminder' && 
    item.reminderDate && 
    new Date(item.reminderDate) < new Date() &&
    item.status !== 'complete';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative ${isDragging ? 'opacity-20' : ''}`}
    >
      <div className={`flex items-center py-2 px-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 transition-all duration-300 ${
        isHighlighted ? 'bg-yellow-100 animate-pulse' : ''
      }`}>
        {/* Drag handle - only show for tasks */}
        {isDraggable && (
          <div 
            className="drag-handle p-1 cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
            {...attributes}
            {...listeners}
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
        )}

        {/* Main content */}
        <div 
          className="flex-1 flex items-center gap-2 ml-2"
          onClick={() => setShowEditModal(true)}
        >
          {/* List color dot - only for tasks */}
          {currentView === 'tasks' && item.listId && (() => {
            const list = lists.find(l => l.id === item.listId);
            return list ? (
              <div 
                className="w-2 h-2 rounded-full flex-shrink-0" 
                style={{ backgroundColor: list.color }}
              />
            ) : null;
          })()}
          
          <span className={`flex-1 text-sm ${
            item.status === 'complete' ? 'line-through text-gray-400' : 'text-gray-800'
          }`}>
            {item.title}
          </span>

          {/* Priority indicator - only show for tasks */}
          {currentView === 'tasks' && (
            <span className={`text-xs font-medium text-white px-2 py-0.5 rounded-full ${priorityColors[item.priority]}`}>
              {priorityLabels[item.priority]}
            </span>
          )}

          {item.type === 'reminder' && item.reminderDate && currentView !== 'recurring' && (() => {
            const reminderDate = new Date(item.reminderDate);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const reminderDateOnly = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());
            
            let dateLabel: string;
            if (reminderDateOnly.getTime() === today.getTime()) {
              dateLabel = `Today at ${format(reminderDate, 'h:mm a')}`;
            } else if (reminderDateOnly.getTime() === tomorrow.getTime()) {
              dateLabel = `Tomorrow at ${format(reminderDate, 'h:mm a')}`;
            } else {
              dateLabel = format(reminderDate, 'MMM d, h:mm a');
            }
            
            return (
              <span className={`text-xs ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                {dateLabel}
              </span>
            );
          })()}

          {item.recurrence && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {item.recurrence.frequency} at {format(new Date(`2000-01-01T${item.recurrence.time}`), 'h:mm a')}
            </span>
          )}
        </div>

        {/* Delete button */}
        <button
          className="delete-button p-1.5 text-gray-400 hover:text-red-600 transition-colors"
          onClick={async (e) => {
            e.stopPropagation();
            if (window.confirm(`Delete "${item.title}"?`)) {
              try {
                await deleteItem(item.id);
              } catch (error) {
                console.error('Failed to delete item:', error);
                alert('Failed to delete item. Please try again.');
              }
            }
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <TaskModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        mode="edit"
        editItem={item}
      />
    </div>
  );
};