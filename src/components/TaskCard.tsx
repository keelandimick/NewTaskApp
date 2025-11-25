import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Item, Priority } from '../types';
import { useStoreWithAuth } from '../store/useStoreWithAuth';
import { format } from 'date-fns';
import { TaskModal } from './TaskModal';
import { renderTextWithLinks } from '../lib/ai';

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
  const { deleteItem, updateItem, currentView, highlightedItemId, lists, selectedItemId, setSelectedItem, setHighlightedItem, itemsInFlight, isDashboardView, setDashboardView, setCurrentView, setCurrentList } = useStoreWithAuth();
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [showPriorityOptions, setShowPriorityOptions] = React.useState(false);
  const isHighlighted = highlightedItemId === item.id;
  const isSelected = selectedItemId === item.id;
  
  // Check if item has an active "on hold" note
  // Find the most recent ON HOLD or OFF HOLD note
  const holdNotes = item.notes.filter(note => 
    note.content.toLowerCase().startsWith('on hold') || 
    note.content.toLowerCase() === 'off hold'
  );
  
  const mostRecentHoldNote = holdNotes.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];
  
  const hasOnHoldNote = mostRecentHoldNote?.content.toLowerCase() === 'off hold' 
    ? false 
    : mostRecentHoldNote?.content.toLowerCase().startsWith('on hold');
  
  // Handle delete key press when selected
  React.useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Don't handle delete if user is typing in an input/textarea
      const activeElement = document.activeElement;
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true'
      );
      
      // Check for both Delete and Backspace keys
      if (isSelected && (e.key === 'Delete' || e.key === 'Backspace') && !isTyping && currentView !== 'trash' && currentView !== 'complete') {
        e.preventDefault();
        if (window.confirm(`Delete "${item.title}"?`)) {
          try {
            await deleteItem(item.id);
          } catch (error) {
            console.error('Failed to delete item:', error);
            alert('Failed to delete item. Please try again.');
          }
        }
      }
    };

    if (isSelected) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isSelected, item.title, item.id, deleteItem, currentView]);
  
  // Close priority options on any click
  React.useEffect(() => {
    if (showPriorityOptions) {
      const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        // Check if click is outside the priority options container
        if (!target.closest(`.priority-options-${item.id}`)) {
          setShowPriorityOptions(false);
        }
      };
      
      // Use capture phase to handle before other click handlers
      document.addEventListener('click', handleClick, true);
      
      return () => {
        document.removeEventListener('click', handleClick, true);
      };
    }
  }, [showPriorityOptions, item.id]);
  
  // Enable dragging for all views except trash and complete
  const isDraggable = currentView !== 'trash' && currentView !== 'complete';
  
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

  const isInFlight = itemsInFlight.has(item.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative ${isDragging ? 'opacity-20' : ''}`}
      data-item-id={item.id}
    >
      <div
        className={`flex items-center py-2 px-2 ${currentView !== 'trash' && currentView !== 'complete' ? 'cursor-pointer' : ''} border-b border-gray-100 transition-all duration-300 ${
          isInFlight ? 'opacity-50 pointer-events-none' : ''
        } ${
          isHighlighted ? 'bg-yellow-100 animate-pulse' : isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
        }`}
        onClick={(e) => {
          e.stopPropagation();
          if (currentView !== 'trash' && currentView !== 'complete') {
            if (selectedItemId === item.id) {
              // Click on already selected item - deselect it
              setSelectedItem(null);
              setHighlightedItem(null);
            } else {
              // Click on different item - select it
              setSelectedItem(item.id);
              setHighlightedItem(null);
            }
          }
        }}
      >
        {/* Loading spinner - show when item is in flight */}
        {isInFlight && (
          <div className="p-0.5">
            <svg className="w-3.5 h-3.5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}

        {/* Drag handle - only show for tasks when not in flight */}
        {isDraggable && !isInFlight && (
          <div
            className="drag-handle p-0.5 cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
            {...attributes}
            {...listeners}
          >
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
        )}

        {/* Main content */}
        <div 
          className="flex-1 ml-1"
        >
          <div className="flex items-center gap-2">
            {/* Completion circle - show for tasks, reminders, and recurring */}
            {(currentView === 'tasks' || currentView === 'reminders' || currentView === 'recurring') && item.listId && (() => {
              const list = lists.find(l => l.id === item.listId);
              return list ? (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await updateItem(item.id, { status: 'complete' });
                    } catch (error) {
                      console.error('Failed to complete item:', error);
                    }
                  }}
                  className="w-3 h-3 rounded-full flex-shrink-0 border-2 hover:bg-gray-100 transition-colors" 
                  style={{ borderColor: list.color }}
                  title="Mark as complete"
                />
              ) : null;
            })()}
            
            <span className={`flex-1 text-[13.5px] ${
              item.status === 'complete' ? 'line-through text-gray-400' : 'text-gray-800'
            }`}>
              {renderTextWithLinks(item.title)}
              {hasOnHoldNote && (
                <span className="ml-2 text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                  ON HOLD
                </span>
              )}
            </span>
          </div>

          {/* Date/time on second line */}
          {(item.type === 'reminder' && item.reminderDate && currentView !== 'recurring') && (() => {
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
              <div className={`text-[11px] mt-0.5 ${isOverdue ? 'text-red-600' : 'text-gray-400'}`}>
                {dateLabel}
              </div>
            );
          })()}

          {item.recurrence && (() => {
            // Format recurrence text nicely (expand abbreviations)
            let displayText = item.recurrence.originalText || item.recurrence.frequency;

            // Expand day abbreviations
            const dayMap: Record<string, string> = {
              'mon': 'Monday', 'monday': 'Monday',
              'tue': 'Tuesday', 'tuesday': 'Tuesday',
              'wed': 'Wednesday', 'wednesday': 'Wednesday',
              'thu': 'Thursday', 'thursday': 'Thursday',
              'fri': 'Friday', 'friday': 'Friday',
              'sat': 'Saturday', 'saturday': 'Saturday',
              'sun': 'Sunday', 'sunday': 'Sunday'
            };

            Object.entries(dayMap).forEach(([abbr, full]) => {
              const regex = new RegExp(`\\b${abbr}\\b`, 'i');
              if (regex.test(displayText)) {
                displayText = displayText.replace(regex, full);
              }
            });

            // Capitalize first letter
            displayText = displayText.charAt(0).toUpperCase() + displayText.slice(1);

            // For interval-based recurrences (minutely/hourly), use reminderDate for accurate local time
            const timeDisplay = (item.recurrence.frequency === 'minutely' || item.recurrence.frequency === 'hourly') && item.type === 'reminder' && item.reminderDate
              ? format(item.reminderDate, 'h:mm a')
              : format(new Date(`2000-01-01T${item.recurrence.time}`), 'h:mm a');

            return (
              <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {`${displayText} at ${timeDisplay}`}
              </div>
            );
          })()}
        </div>

        {/* Notes indicator and Priority badge container */}
        {currentView !== 'trash' && currentView !== 'complete' && (
          <div className="flex items-center gap-2">
            {/* Notes indicator */}
            {item.notes.length > 0 && (
              <span className="text-base" title={`${item.notes.length} note${item.notes.length === 1 ? '' : 's'}`}>
                📝
              </span>
            )}
            
            {/* Priority badge */}
            <div className={`relative priority-options-${item.id}`}>
                {showPriorityOptions && (
                  <div className="absolute right-0 top-6 z-10 flex gap-1 bg-white rounded-lg shadow-lg p-1">
                    {(['now', 'high', 'low'] as Priority[]).map((priority) => (
                      <button
                        key={priority}
                        onClick={async (e) => {
                          e.stopPropagation();
                          setShowPriorityOptions(false);
                          // Guard check: Don't update if priority is already the same
                          if (item.priority === priority) return;

                          const oldPriority = item.priority;
                          try {
                            await updateItem(item.id, { priority });

                            // Navigate if changing priority away from "now" while in Dashboard
                            if (isDashboardView && oldPriority === 'now' && priority !== 'now') {
                              setDashboardView(false);
                              setCurrentView('tasks');
                              setCurrentList(item.listId);

                              // Highlight the item after navigation
                              setTimeout(() => {
                                setSelectedItem(item.id);
                                setHighlightedItem(item.id);

                                // Scroll to item
                                setTimeout(() => {
                                  const element = document.getElementById(`item-${item.id}`);
                                  if (element) {
                                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }
                                }, 100);
                              }, 50);
                            }
                          } catch (error) {
                            console.error('Failed to update priority:', error);
                          }
                        }}
                        className={`text-[10px] font-medium text-white px-1.5 py-0.5 rounded-full cursor-pointer transition-all ${
                          item.priority === priority ? 'ring-2 ring-gray-400' : ''
                        } ${priorityColors[priority]}`}
                      >
                        {priorityLabels[priority]}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPriorityOptions(true);
                  }}
                  className={`text-[10px] font-medium text-white px-1.5 py-0.5 rounded-full cursor-pointer hover:ring-2 hover:ring-gray-300 transition-all ${priorityColors[item.priority]}`}
                >
                  {priorityLabels[item.priority]}
                </button>
            </div>
          </div>
        )}
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