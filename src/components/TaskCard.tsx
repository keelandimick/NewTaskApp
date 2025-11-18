import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Item, Priority, ViewMode } from '../types';
import { useStoreWithAuth } from '../store/useStoreWithAuth';
import { format } from 'date-fns';
import { TaskModal } from './TaskModal';
import customChrono from '../lib/chronoConfig';
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
  const { deleteItem, updateItem, currentView, highlightedItemId, lists, items, selectedItemId, setSelectedItem, setCurrentView, setHighlightedItem } = useStoreWithAuth();
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [showPriorityOptions, setShowPriorityOptions] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState(item.title);
  const [isNavigating, setIsNavigating] = React.useState(false);
  const [previewDate, setPreviewDate] = React.useState<Date | null>(null);
  const [previewRecurrence, setPreviewRecurrence] = React.useState<string | null>(null);
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
  
  // Reset editing state when selection changes
  React.useEffect(() => {
    if (!isSelected) {
      setIsEditing(false);
      setEditTitle(item.title);
      setPreviewDate(null);
      setPreviewRecurrence(null);
    }
  }, [isSelected, item.title]);


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
      if (isSelected && (e.key === 'Delete' || e.key === 'Backspace') && !isEditing && !isTyping && currentView !== 'trash' && currentView !== 'complete') {
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
  }, [isSelected, isEditing, item.title, item.id, deleteItem, currentView]);
  
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative ${isDragging ? 'opacity-20' : ''}`}
      data-item-id={item.id}
    >
      <div 
        className={`flex items-center py-2 px-2 ${currentView !== 'trash' && currentView !== 'complete' ? 'cursor-pointer' : ''} border-b border-gray-100 transition-all duration-300 ${
          isHighlighted ? 'bg-yellow-100 animate-pulse' : isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
        }`}
        onClick={(e) => {
          e.stopPropagation();
          if (currentView !== 'trash' && currentView !== 'complete' && !isEditing) {
            if (selectedItemId === item.id) {
              // Click on already selected item - deselect it
              setSelectedItem(null);
            } else {
              // Click on different item - select it
              setSelectedItem(item.id);
            }
          }
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (currentView !== 'trash' && currentView !== 'complete') {
            // Double click - enable inline editing without changing selection
            setIsEditing(true);
          }
        }}
      >
        {/* Drag handle - only show for tasks */}
        {isDraggable && (
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
            
            {isEditing ? (
              <textarea
                value={editTitle}
                onChange={(e) => {
                  const value = e.target.value;
                  setEditTitle(value);
                  
                  // Auto-resize textarea
                  e.target.style.height = '0px';
                  e.target.style.height = e.target.scrollHeight + 'px';
                  
                  // Live preview of dates/recurrence
                  const recurringMatch = value.match(/\b(every\s+(other\s+)?\d*\s*(day|week|month|year|hours?|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|daily|weekly|monthly|yearly|annually|weekdays?|weekends?)\b/i);
                  if (recurringMatch) {
                    setPreviewRecurrence(recurringMatch[0]);
                    setPreviewDate(null);
                  } else {
                    const parsedDate = customChrono.parseDate(value);
                    if (parsedDate) {
                      setPreviewDate(parsedDate);
                      setPreviewRecurrence(null);
                    } else {
                      setPreviewDate(null);
                      setPreviewRecurrence(null);
                    }
                  }
                }}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    
                    // Parse for dates and recurring patterns
                    let finalTitle = editTitle.trim();
                    let updates: any = { title: finalTitle };
                    
                    // Check for recurring patterns first
                    const recurringMatch = editTitle.match(/\b(every\s+(other\s+)?\d*\s*(day|week|month|year|hours?|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|daily|weekly|monthly|yearly|annually|weekdays?|weekends?)\b/i);
                    if (recurringMatch) {
                      // Extract recurrence and clean title
                      finalTitle = editTitle.replace(recurringMatch[0], '').trim();
                      if (finalTitle.length > 0) {
                        finalTitle = finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
                      }
                      updates.title = finalTitle;
                      updates.type = 'reminder';
                      updates.recurrence = {
                        frequency: 'weekly', // Default, would need pattern matching
                        time: '09:00',
                        originalText: recurringMatch[0]
                      };
                      updates.status = 'weekly'; // Set status to match frequency
                    } else {
                      // Check for single date
                      const parsedDate = customChrono.parseDate(editTitle);
                      if (parsedDate) {
                        const parsedText = customChrono.parse(editTitle)[0].text;
                        finalTitle = editTitle.replace(parsedText, '').trim();
                        if (finalTitle.length > 0) {
                          finalTitle = finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
                        }
                        updates.title = finalTitle;
                        updates.type = 'reminder';
                        updates.reminderDate = parsedDate;
                        // Calculate and set the appropriate status
                        const now = new Date();
                        const reminderDateOnly = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
                        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        const diffTime = reminderDateOnly.getTime() - todayStart.getTime();
                        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                        
                        if (diffDays < 0) {
                          updates.status = 'today';
                        } else if (diffDays === 0) {
                          updates.status = 'today';
                        } else if (diffDays <= 7) {
                          updates.status = 'within7';
                        } else {
                          updates.status = '7plus';
                        }
                      }
                    }
                    
                    // Skip AI processing - just capitalize first letter
                    if (finalTitle.length > 0) {
                      finalTitle = finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
                      updates.title = finalTitle;
                    }
                    
                    // Check for duplicates (case insensitive) in active items only
                    const normalizedTitle = finalTitle.toLowerCase();
                    const duplicateExists = items.some(otherItem => 
                      !otherItem.deletedAt && 
                      otherItem.status !== 'complete' &&
                      otherItem.title.toLowerCase() === normalizedTitle &&
                      otherItem.id !== item.id // Don't check against self
                    );
                    
                    if (duplicateExists) {
                      alert('A task with this title already exists');
                      setIsEditing(false);
                      setEditTitle(item.title); // Reset to original title
                      return;
                    }
                    
                    try {
                      await updateItem(item.id, updates);
                      setIsEditing(false);
                      
                      // Navigate to appropriate view if item type changed
                      if (updates.type === 'reminder') {
                        let targetView: ViewMode = 'reminders';
                        if (updates.recurrence) {
                          targetView = 'recurring';
                        }
                        if (targetView !== currentView) {
                          setIsNavigating(true); // Prevent onBlur from resetting
                          setCurrentView(targetView);
                          setHighlightedItem(item.id);
                        }
                      }
                    } catch (error) {
                      console.error('Failed to update item:', error);
                    }
                  } else if (e.key === 'Escape') {
                    setEditTitle(item.title);
                    setIsEditing(false);
                    setPreviewDate(null);
                    setPreviewRecurrence(null);
                  }
                }}
                onBlur={async () => {
                  if (!isNavigating) {
                    // Save changes on blur (same as pressing Enter)
                    let finalTitle = editTitle.trim();
                    if (finalTitle && finalTitle !== item.title) {
                      let updates: any = { title: finalTitle };
                      
                      // Check for recurring patterns first
                      const recurringMatch = editTitle.match(/\b(every\s+(other\s+)?\d*\s*(day|week|month|year|hours?|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|daily|weekly|monthly|yearly|annually|weekdays?|weekends?)\b/i);
                      if (recurringMatch) {
                        // Extract recurrence and clean title
                        finalTitle = editTitle.replace(recurringMatch[0], '').trim();
                        if (finalTitle.length > 0) {
                          finalTitle = finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
                        }
                        updates.title = finalTitle;
                        updates.type = 'reminder';
                        updates.recurrence = {
                          frequency: 'weekly', // Default, would need pattern matching
                          time: '09:00',
                          originalText: recurringMatch[0]
                        };
                        updates.status = 'weekly'; // Set status to match frequency
                      } else {
                        // Check for single date
                        const parsedDate = customChrono.parseDate(editTitle);
                        if (parsedDate) {
                          const parsedText = customChrono.parse(editTitle)[0].text;
                          finalTitle = editTitle.replace(parsedText, '').trim();
                          if (finalTitle.length > 0) {
                            finalTitle = finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
                          }
                          updates.title = finalTitle;
                          updates.type = 'reminder';
                          updates.reminderDate = parsedDate;
                          // Calculate and set the appropriate status
                          const now = new Date();
                          const reminderDateOnly = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
                          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                          const diffTime = reminderDateOnly.getTime() - todayStart.getTime();
                          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                          
                          if (diffDays < 0) {
                            updates.status = 'today';
                          } else if (diffDays === 0) {
                            updates.status = 'today';
                          } else if (diffDays <= 7) {
                            updates.status = 'within7';
                          } else {
                            updates.status = '7plus';
                          }
                        }
                      }
                      
                      // Skip AI processing - just capitalize first letter
                      if (finalTitle.length > 0) {
                        finalTitle = finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
                        updates.title = finalTitle;
                      }
                      
                      // Check for duplicates (case insensitive) in active items only
                      const normalizedTitle = finalTitle.toLowerCase();
                      const duplicateExists = items.some(otherItem => 
                        !otherItem.deletedAt && 
                        otherItem.status !== 'complete' &&
                        otherItem.title.toLowerCase() === normalizedTitle &&
                        otherItem.id !== item.id // Don't check against self
                      );
                      
                      if (duplicateExists) {
                        alert('A task with this title already exists');
                        setEditTitle(item.title); // Reset to original title
                        setIsEditing(false);
                        return;
                      }
                      
                      try {
                        await updateItem(item.id, updates);
                        
                        // Navigate to appropriate view if item type changed
                        if (updates.type === 'reminder') {
                          let targetView: ViewMode = 'reminders';
                          if (updates.recurrence) {
                            targetView = 'recurring';
                          }
                          if (targetView !== currentView) {
                            setIsNavigating(true); // Prevent onBlur from resetting
                            setCurrentView(targetView);
                            setHighlightedItem(item.id);
                          }
                        }
                      } catch (error) {
                        console.error('Failed to update item:', error);
                      }
                    }
                    
                    setIsEditing(false);
                    setPreviewDate(null);
                    setPreviewRecurrence(null);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => {
                  // Place cursor at end without selecting text
                  const target = e.target as HTMLTextAreaElement;
                  target.setSelectionRange(editTitle.length, editTitle.length);
                }}
                className="flex-1 text-[13.5px] bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 m-0 resize-none overflow-hidden leading-normal"
                rows={1}
                autoFocus
                spellCheck="true"
                style={{ lineHeight: 'inherit' }}
                ref={(textarea) => {
                  if (textarea) {
                    textarea.style.height = '0px';
                    textarea.style.height = textarea.scrollHeight + 'px';
                  }
                }}
              />
            ) : (
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
            )}
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

          {item.recurrence && (
            <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {item.recurrence.originalText 
                ? `${item.recurrence.originalText} at ${format(new Date(`2000-01-01T${item.recurrence.time}`), 'h:mm a')}`
                : `${item.recurrence.frequency} at ${format(new Date(`2000-01-01T${item.recurrence.time}`), 'h:mm a')}`}
            </div>
          )}

          {/* Live preview when editing */}
          {isEditing && previewDate && (() => {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const previewDateOnly = new Date(previewDate.getFullYear(), previewDate.getMonth(), previewDate.getDate());
            
            let dateLabel: string;
            if (previewDateOnly.getTime() === today.getTime()) {
              dateLabel = `Today at ${format(previewDate, 'h:mm a')}`;
            } else if (previewDateOnly.getTime() === tomorrow.getTime()) {
              dateLabel = `Tomorrow at ${format(previewDate, 'h:mm a')}`;
            } else {
              dateLabel = format(previewDate, 'MMM d, h:mm a');
            }
            
            return (
              <div className="text-[11px] mt-0.5 text-blue-500">
                → {dateLabel}
              </div>
            );
          })()}
          
          {isEditing && previewRecurrence && (
            <div className="text-[11px] text-blue-500 flex items-center gap-1 mt-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              → {previewRecurrence} at 9:00 AM
            </div>
          )}
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
                          try {
                            await updateItem(item.id, { priority });
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